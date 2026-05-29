import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Parse cell like "COM", "SEM", "COM (8)", "COM (10-14)"
function parseCell(raw: unknown): {
  included: boolean | null;
  threshold: number | null;
  thresholdMax: number | null;
} {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return { included: null, threshold: null, thresholdMax: null };
  if (s.startsWith("SEM")) return { included: false, threshold: null, thresholdMax: null };
  if (s.startsWith("COM")) {
    const m = s.match(/\(([^)]+)\)/);
    if (m) {
      const inside = m[1].replace(",", ".");
      const range = inside.match(/(-?\d+(?:\.\d+)?)\s*[-–a]\s*(-?\d+(?:\.\d+)?)/);
      if (range) {
        return {
          included: true,
          threshold: parseFloat(range[1]),
          thresholdMax: parseFloat(range[2]),
        };
      }
      const single = inside.match(/(-?\d+(?:\.\d+)?)/);
      if (single) {
        return { included: true, threshold: parseFloat(single[1]), thresholdMax: null };
      }
    }
    return { included: true, threshold: null, thresholdMax: null };
  }
  return { included: null, threshold: null, thresholdMax: null };
}

const COMPONENT_KEYS: Record<string, string> = {
  cgs: "includes_cgs",
  erc: "includes_cgs",
  fts: "includes_fts",
  "tarifa social": "includes_fts",
  mfrr: "includes_mfrr",
  tar: "includes_tar",
  perdas: "includes_perdas",
  desvios: "includes_desvios",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Ficheiro em falta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rows.length) {
      return new Response(JSON.stringify({ error: "Folha vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify header row: contains supplier + at least one component column
    let headerIdx = -1;
    let supplierCol = -1;
    let campaignCol = -1;
    const compCols: { col: number; key: string }[] = [];

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i].map((c) => norm(c));
      const sIdx = row.findIndex(
        (c) => c.includes("comercializadora") || c === "fornecedor" || c === "supplier"
      );
      if (sIdx === -1) continue;
      headerIdx = i;
      supplierCol = sIdx;
      campaignCol = row.findIndex((c) => c.includes("campanha") || c.includes("campaign"));
      for (let j = 0; j < row.length; j++) {
        for (const [key, dbKey] of Object.entries(COMPONENT_KEYS)) {
          if (row[j].includes(key)) {
            compCols.push({ col: j, key: dbKey });
            break;
          }
        }
      }
      break;
    }

    if (headerIdx === -1 || !compCols.length) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível identificar cabeçalho (precisa de coluna 'Comercializadora' + componentes CGS/FTS/mFRR/TAR/Perdas/Desvios)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const upserts: any[] = [];
    let skipped = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const supplier = String(row[supplierCol] ?? "").trim();
      if (!supplier) {
        skipped++;
        continue;
      }
      const campaign =
        campaignCol >= 0 ? String(row[campaignCol] ?? "").trim() || null : null;

      const record: any = {
        supplier_name: supplier,
        campaign_name: campaign,
        includes_cgs: false,
        includes_fts: false,
        includes_mfrr: false,
        includes_tar: false,
        includes_perdas: true,
        includes_desvios: false,
        cgs_threshold: null,
        cgs_threshold_max: null,
        threshold_behavior: "none",
      };

      for (const { col, key } of compCols) {
        const parsed = parseCell(row[col]);
        if (parsed.included !== null) record[key] = parsed.included;
        if (key === "includes_cgs" && parsed.included && parsed.threshold !== null) {
          record.cgs_threshold = parsed.threshold;
          record.cgs_threshold_max = parsed.thresholdMax;
          record.threshold_behavior = parsed.thresholdMax !== null ? "both" : "excess_billed";
        }
      }
      upserts.push(record);
    }

    // Manual upsert keyed on (supplier_name, campaign_name) — campaign may be NULL
    let inserted = 0;
    let updated = 0;
    for (const rec of upserts) {
      const query = supabase
        .from("supplier_inclusions")
        .select("id")
        .eq("supplier_name", rec.supplier_name);
      const { data: existing } = rec.campaign_name
        ? await query.eq("campaign_name", rec.campaign_name).maybeSingle()
        : await query.is("campaign_name", null).maybeSingle();

      if (existing?.id) {
        await supabase.from("supplier_inclusions").update(rec).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("supplier_inclusions").insert(rec);
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        updated,
        skipped,
        total: upserts.length,
        components: compCols.map((c) => c.key),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
