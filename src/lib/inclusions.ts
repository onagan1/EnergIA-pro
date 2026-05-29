import { supabase } from "@/lib/supabase";

export interface SupplierInclusion {
  id: string;
  supplier_name: string;
  campaign_name: string | null;
  includes_cgs: boolean;
  includes_fts: boolean;
  includes_mfrr: boolean;
  includes_tar: boolean;
  includes_perdas: boolean;
  includes_desvios: boolean;
  cgs_threshold: number | null;
  cgs_threshold_max: number | null;
  threshold_behavior: "none" | "excess_billed" | "credit_below" | "both";
  notes: string | null;
}

export interface ResolvedInclusions {
  includesCGS: boolean;
  includesFTS: boolean;
  includesMFRR: boolean;
  includesTAR: boolean;
  includesPerdas: boolean;
  includesDesvios: boolean;
  cgsThreshold: number | null;
  cgsThresholdMax: number | null;
  thresholdBehavior: "none" | "excess_billed" | "credit_below" | "both";
  matched: "supplier_campaign" | "supplier_default" | "fallback";
  source?: SupplierInclusion;
}

const DEFAULTS: ResolvedInclusions = {
  includesCGS: false,
  includesFTS: false,
  includesMFRR: false,
  includesTAR: false,
  includesPerdas: true,
  includesDesvios: false,
  cgsThreshold: null,
  cgsThresholdMax: null,
  thresholdBehavior: "none",
  matched: "fallback",
};

export const normalizeName = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export async function fetchAllInclusions(): Promise<SupplierInclusion[]> {
  const { data, error } = await supabase
    .from("supplier_inclusions" as any)
    .select("*");
  if (error) throw error;
  return (data ?? []) as unknown as SupplierInclusion[];
}

export function resolveInclusions(
  rows: SupplierInclusion[],
  supplierName: string,
  campaignName?: string | null
): ResolvedInclusions {
  const sNorm = normalizeName(supplierName);
  const cNorm = normalizeName(campaignName);
  if (!sNorm) return DEFAULTS;

  const supplierRows = rows.filter(
    (r) => normalizeName(r.supplier_name) === sNorm
  );
  if (!supplierRows.length) return DEFAULTS;

  let match: SupplierInclusion | undefined;
  let matched: ResolvedInclusions["matched"] = "fallback";

  if (cNorm) {
    match = supplierRows.find(
      (r) => normalizeName(r.campaign_name) === cNorm
    );
    if (match) matched = "supplier_campaign";
  }
  if (!match) {
    match = supplierRows.find((r) => !r.campaign_name);
    if (match) matched = "supplier_default";
  }
  if (!match) {
    match = supplierRows[0];
    matched = "supplier_default";
  }

  return {
    includesCGS: match.includes_cgs,
    includesFTS: match.includes_fts,
    includesMFRR: match.includes_mfrr,
    includesTAR: match.includes_tar,
    includesPerdas: match.includes_perdas,
    includesDesvios: match.includes_desvios,
    cgsThreshold: match.cgs_threshold,
    cgsThresholdMax: match.cgs_threshold_max,
    thresholdBehavior: match.threshold_behavior,
    matched,
    source: match,
  };
}
