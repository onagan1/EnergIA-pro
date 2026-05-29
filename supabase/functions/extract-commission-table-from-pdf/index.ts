import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `És um extrator de tabelas de comissões de comercializadores de energia (Portugal).
Recebes um PDF e devolves um JSON estrito com a lista de linhas comissionais.

Formato OBRIGATÓRIO:
{
  "rows": [
    {
      "supplier_name": "string",         // nome do comercializador (Axpo, Plenitude, Iberdrola, Endesa, EDP, etc.)
      "campaign_name": "string|null",    // nome da campanha/produto
      "basis": "power|consumption|margin_k", // base de cálculo
      "criteria_type": "string|null",    // ex: "potencia", "consumo_anual", "escalao"
      "criteria_value": "string|null",   // ex: "3.45 a 20.70", ">10000 kWh"
      "commission_value": number,        // valor numérico
      "commission_unit": "euro|euro_kw|euro_mwh|percent",
      "payment_mode": "one_shot|recurring",
      "notes": "string|null"
    }
  ]
}

Regras:
- basis "power" → comissão por potência contratada (normalmente €)
- basis "consumption" → comissão por consumo (€/MWh)
- basis "margin_k" → percentagem sobre margem K (%)
- Devolve APENAS JSON válido, sem markdown, sem comentários.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { pdfBase64, fileName } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: 'pdfBase64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extrai as comissões deste documento${fileName ? ` (${fileName})` : ''}.` },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('AI error', aiRes.status, txt);
      return new Response(JSON.stringify({ error: 'AI request failed', detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? '';

    // Strip markdown fences and parse
    let cleaned = content.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) cleaned = objMatch[0];

    let parsed: { rows?: unknown[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Parse failed', cleaned.slice(0, 500));
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: content }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ rows: parsed.rows ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
