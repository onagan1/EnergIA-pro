import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  parseJsonBody,
  DynamicsPayloadSchema,
} from "../_shared/validation.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilizador não autenticado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Receiving proposal data for Dynamics 365...");

    const parsed = await parseJsonBody(req, DynamicsPayloadSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    console.log("Sending data to Power Automate webhook:", payload.webhookUrl);
    console.log("Client:", payload.cliente.nome);
    console.log("Commercial:", payload.comercial.nome);

    // Prepare payload for Power Automate (without the webhookUrl)
    const powerAutomatePayload = {
      cliente: payload.cliente,
      comercial: payload.comercial,
      consumo: payload.consumo,
      resultados: payload.resultados,
      fornecedores: payload.fornecedores,
      metadata: payload.metadata
    };

    // Send to Power Automate
    const response = await fetch(payload.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(powerAutomatePayload),
    });

    console.log("Power Automate response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Power Automate error:", errorText);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao enviar para Power Automate", 
          status: response.status 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = { message: "Enviado com sucesso" };
    }

    console.log("Successfully sent to Power Automate");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Proposta enviada para Dynamics 365 com sucesso",
        data: responseData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Detailed error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar pedido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
