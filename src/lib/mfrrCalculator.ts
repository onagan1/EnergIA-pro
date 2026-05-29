import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

export interface MFRRData {
  averageUnitCost: number; // €/kWh
  averageUnitCostMWh: number; // €/MWh
  totalPeriods: number;
  month: string; // e.g. "02/2026"
  source?: "REN API" | "Excel";
}

function excelDateToJS(serial: number): Date {
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400 * 1000);
}

function parseRowDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number" && value > 30000 && value < 60000) return excelDateToJS(value);
  const str = String(value).trim();
  if (!str) return null;
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    const d = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

async function fromRenApi(): Promise<MFRRData> {
  const { data, error } = await supabase.functions.invoke("fetch-ren-market-data");
  if (error) throw error;
  if (!data || data.error) throw new Error(data?.error || "REN API error");
  return {
    averageUnitCost: data.mfrr.unitCostKWh,
    averageUnitCostMWh: data.mfrr.unitCostMWh,
    totalPeriods: 1,
    month: data.month,
    source: "REN API",
  };
}

async function fromExcelFallback(): Promise<MFRRData> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageUrl = `https://${projectId}.supabase.co/storage/v1/object/public/mfrr-data/mfrr_latest.xlsx`;
  const res = await fetch(storageUrl);
  if (!res.ok) throw new Error("Ficheiro mFRR não disponível.");
  const buf = await res.arrayBuffer();
  if (buf.byteLength <= 500) throw new Error("Ficheiro mFRR inválido.");

  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  if (!rows.length) throw new Error("Ficheiro mFRR vazio.");

  const keys = Object.keys(rows[0] || {});
  const unitCostKey =
    keys.find((k) => k.toLowerCase().includes("mfrr") && k.toLowerCase().includes("custo")) ||
    keys.find((k) => k.toLowerCase().includes("mfrr") && k.toLowerCase().includes("unit")) ||
    keys.find((k) => k.toLowerCase().includes("mfrr"));
  const dateKey = keys.find(
    (k) => k.includes("Dia Mercado") || k.includes("Data UTC") || k.includes("Data") || k.toLowerCase().includes("date")
  );
  if (!unitCostKey) throw new Error("Coluna mFRR não encontrada.");

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let ty = prev.getFullYear();
  let tm = prev.getMonth();
  let sum = 0, count = 0;

  const accumulate = (year: number, month: number) => {
    sum = 0; count = 0;
    for (const row of rows) {
      if (dateKey) {
        const d = parseRowDate(row[dateKey]);
        if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
      }
      const v = parseFloat(String(row[unitCostKey]).replace(",", "."));
      if (!isNaN(v)) { sum += v; count++; }
    }
  };
  accumulate(ty, tm);

  if (count === 0 && dateKey) {
    const monthSet = new Set<string>();
    for (const row of rows) {
      const d = parseRowDate(row[dateKey]);
      if (d) monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const sorted = [...monthSet].sort().reverse();
    if (sorted[0]) {
      const [ly, lm] = sorted[0].split("-").map(Number);
      ty = ly; tm = lm - 1;
      accumulate(ty, tm);
    }
  }
  if (count === 0) throw new Error("Sem dados mFRR válidos.");

  const avgMWh = sum / count;
  return {
    averageUnitCost: avgMWh / 1000,
    averageUnitCostMWh: avgMWh,
    totalPeriods: count,
    month: `${String(tm + 1).padStart(2, "0")}/${ty}`,
    source: "Excel",
  };
}

export async function calculateMFRRUnitCost(): Promise<MFRRData> {
  try {
    return await fromRenApi();
  } catch (e) {
    console.warn("REN API failed for mFRR, falling back to Excel:", e);
    return await fromExcelFallback();
  }
}
