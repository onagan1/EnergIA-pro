// Fetches ERC and mFRR monthly unit costs directly from REN's public API.
// Source: https://mercadoservices.ren.pt/ (consumed by mercado.ren.pt SPFx web parts).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Public key embedded in REN's own front-end JS (not a real secret).
// Override via REN_API_KEY env var if REN ever rotates it.
const DEFAULT_KEY = "bWVyY2Fkb19tTDI3M0J0aUxlUmNxZnFCcUltV0JmNXV2UFRtZFc0Vkh4YjRFZUQ2";

interface CacheEntry {
  at: number;
  body: unknown;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;

interface RenRow {
  ANO: string;
  MES: string;
  CONSUMO_MERCADO: string;
  ERC_TOT_VALOR: string;
  ERC_TOT_UNIT: string;
  RPDBF_UNIT: string;
  RPDVD_UNIT: string;
  RPHF_UNIT: string;
  BAFRR_UNIT: string;
  BMFRR_UNIT: string;
  OUTROS_UNIT: string;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

async function fetchYear(year: number): Promise<RenRow[]> {
  const key = Deno.env.get("REN_API_KEY") || DEFAULT_KEY;
  const url = `https://mercadoservices.ren.pt/api/ERCPeriodo/GetERCByYear?language=PT&yearQuery=${year}`;
  const res = await fetch(url, {
    headers: { "X-ApiKey": key, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`REN API ${res.status}`);
  // REN returns a JSON-encoded string (string of JSON). Unwrap if needed.
  const raw = await res.text();
  let parsed: unknown = JSON.parse(raw);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as RenRow[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // "YYYY-MM"
    const force = url.searchParams.get("refresh") === "1";

    const now = new Date();
    let targetYear: number;
    let targetMonth: number; // 1-12
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [targetYear, targetMonth] = monthParam.split("-").map(Number) as [number, number];
    } else {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetYear = prev.getFullYear();
      targetMonth = prev.getMonth() + 1;
    }

    const cacheKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && Date.now() - cached.at < TTL_MS) {
      return new Response(JSON.stringify({ ...cached.body, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rows = await fetchYear(targetYear);
    let row = rows.find((r) => Number(r.ANO) === targetYear && Number(r.MES) === targetMonth);

    // Fallback: latest month available (try requested year, then previous year)
    let usedFallback = false;
    if (!row) {
      const sorted = [...rows].sort((a, b) =>
        Number(b.ANO) - Number(a.ANO) || Number(b.MES) - Number(a.MES)
      );
      row = sorted[0];
      if (!row) {
        rows = await fetchYear(targetYear - 1);
        row = [...rows].sort((a, b) =>
          Number(b.ANO) - Number(a.ANO) || Number(b.MES) - Number(a.MES)
        )[0];
      }
      usedFallback = !!row;
    }

    if (!row) throw new Error("Sem dados disponíveis na REN");

    const ercMWh = num(row.ERC_TOT_UNIT);
    const mfrrMWh = num(row.BMFRR_UNIT);
    const afrrMWh = num(row.BAFRR_UNIT);

    const monthLabel = `${row.MES.padStart(2, "0")}/${row.ANO}`;
    const body = {
      month: monthLabel,
      year: Number(row.ANO),
      monthNumber: Number(row.MES),
      requested: cacheKey,
      usedFallback,
      erc: { unitCostMWh: ercMWh, unitCostKWh: ercMWh / 1000 },
      mfrr: { unitCostMWh: mfrrMWh, unitCostKWh: mfrrMWh / 1000 },
      afrr: { unitCostMWh: afrrMWh, unitCostKWh: afrrMWh / 1000 },
      components: {
        rpdbf: num(row.RPDBF_UNIT),
        rpdvd: num(row.RPDVD_UNIT),
        rphf: num(row.RPHF_UNIT),
        outros: num(row.OUTROS_UNIT),
      },
      consumoMercadoMWh: num(row.CONSUMO_MERCADO),
      source: "REN mercadoservices.ren.pt",
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { at: Date.now(), body });

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("fetch-ren-market-data error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
