import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  parseJsonBody,
  z,
  SupplierPricesAISchema,
} from "../_shared/validation.ts";

const RequestSchema = z.object({
  pdfText: z.string().min(1, "pdfText é obrigatório"),
  supplierName: z.string().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const parsed = await parseJsonBody(req, RequestSchema);
    if (!parsed.ok) return parsed.response;
    const { pdfText, supplierName } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Extracting prices from PDF text, length:", pdfText.length);

    const systemPrompt = `Você é um assistente especializado em extrair preços de energia de documentos PDF de comercializadoras de energia em Portugal.

Extraia os seguintes dados do texto fornecido:
- Nome do comercializador (se disponível)
- Preço por kWh para cada período tarifário (Ponta, Cheia, Vazio, Super Vazio)
- Preço da potência contratada (€/kVA/dia)
- Se o plano tem fidelização ou não

Se algum valor não estiver presente, use 0.

IMPORTANTE: 
- Os preços de energia são normalmente expressos em €/kWh
- Os preços de potência são normalmente expressos em €/kVA/dia
- Procure por tabelas de preços, tarifários, ou condições económicas
- Os valores podem estar em formato decimal com vírgula (ex: 0,1234) ou ponto (ex: 0.1234)
- Identifique se o documento menciona fidelização, contrato com permanência, ou condições similares
- Palavras-chave para fidelização: "fidelização", "fid", "com contrato", "12 meses", "24 meses", "permanência"
- Palavras-chave para sem fidelização: "sem fidelização", "sfid", "sem contrato", "sem permanência"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extrai os preços de energia do seguinte texto de um PDF de uma comercializadora${supplierName ? ` (${supplierName})` : ""}:\n\n${pdfText}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_supplier_prices",
              description: "Extrair preços de energia de um documento PDF de comercializadora",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string", 
                    description: "Nome do comercializador de energia" 
                  },
                  pricePonta: { 
                    type: "number", 
                    description: "Preço em €/kWh para o período de Ponta" 
                  },
                  priceCheia: { 
                    type: "number", 
                    description: "Preço em €/kWh para o período de Cheia" 
                  },
                  priceVazio: { 
                    type: "number", 
                    description: "Preço em €/kWh para o período de Vazio" 
                  },
                  priceSuperVazio: { 
                    type: "number", 
                    description: "Preço em €/kWh para o período de Super Vazio" 
                  },
                  powerPrice: { 
                    type: "number", 
                    description: "Preço da potência em €/kVA/dia" 
                  },
                  hasLoyalty: {
                    type: "boolean",
                    description: "Indica se o plano tem fidelização (true) ou não (false)"
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Nível de confiança na extração dos dados"
                  },
                  notes: {
                    type: "string",
                    description: "Notas ou observações sobre os dados extraídos"
                  }
                },
                required: ["name", "pricePonta", "priceCheia", "priceVazio", "priceSuperVazio", "powerPrice", "hasLoyalty", "confidence"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_supplier_prices" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_supplier_prices") {
      throw new Error("Failed to extract prices from PDF");
    }

    let rawExtracted: unknown;
    try {
      rawExtracted = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse AI response JSON:", parseError);
      return jsonResponse({ error: "Resposta da IA com formato inválido" }, 502);
    }
    if (!rawExtracted || typeof rawExtracted !== "object") {
      return jsonResponse({ error: "Resposta da IA sem estrutura esperada" }, 502);
    }
    const aiValidation = SupplierPricesAISchema.safeParse(rawExtracted);
    if (!aiValidation.success) {
      console.error("AI returned invalid schema:", aiValidation.error.flatten());
      return jsonResponse(
        { error: "Resposta da IA com formato inválido", fields: aiValidation.error.flatten().fieldErrors },
        502,
      );
    }
    const extractedData = aiValidation.data;
    console.log("Extracted data:", extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-supplier-prices:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
