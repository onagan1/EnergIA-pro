import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

export interface ERCData {
  averageUnitCost: number; // €/kWh
  averageUnitCostMWh: number; // €/MWh
  totalPeriods: number;
  dateRange: { from: string; to: string };
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

async function fromRenApi(): Promise<ERCData> {
  const { data, error } = await supabase.functions.invoke("fetch-ren-market-data");
  if (error) throw error;
  if (!data || data.error) throw new Error(data?.error || "REN API error");
  return {
    averageUnitCost: data.erc.unitCostKWh,
    averageUnitCostMWh: data.erc.unitCostMWh,
    totalPeriods: 1,
    dateRange: { from: data.month, to: data.month },
    month: data.month,
    source: "REN API",
  };
}

async function fromExcelFallback(): Promise<ERCData> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageUrl = `https://${projectId}.supabase.co/storage/v1/object/public/erc-data/erc_isp_latest.xlsx`;
  let buf: ArrayBuffer | null = null;
  try {
    const res = await fetch(storageUrl);
    if (res.ok) {
      const b = await res.arrayBuffer();
      if (b.byteLength > 1000) buf = b;
    }
  } catch { /* ignore */ }
  if (!buf) {
    const res = await fetch("/data/erc_isp.xlsx");
    buf = await res.arrayBuffer();
  }

  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const unitCostKey = Object.keys(rows[0] || {}).find(
    (k) => k.includes("ERC Total") && k.includes("Custo Unitário")
  );
  const dateKey = Object.keys(rows[0] || {}).find(
    (k) => k.includes("Dia Mercado") || k.includes("Data UTC") || k.includes("Data")
  );
  if (!unitCostKey) throw new Error("Coluna ERC Total não encontrada.");

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ty = prev.getFullYear();
  const tm = prev.getMonth();
  let sum = 0, count = 0, minDate = "", maxDate = "";

  const accumulate = (year: number, month: number) => {
    sum = 0; count = 0; minDate = ""; maxDate = "";
    for (const row of rows) {
      const d = dateKey ? parseRowDate(row[dateKey]) : null;
      if (dateKey && (!d || d.getFullYear() !== year || d.getMonth() !== month)) continue;
      const v = parseFloat(String(row[unitCostKey]));
      if (!isNaN(v)) { sum += v; count++; }
      if (dateKey) {
        const ds = String(row[dateKey] || "");
        if (ds && (!minDate || ds < minDate)) minDate = ds;
        if (ds && (!maxDate || ds > maxDate)) maxDate = ds;
      }
    }
  };
  accumulate(ty, tm);

  let monthLabel = `${String(tm + 1).padStart(2, "0")}/${ty}`;
  if (count === 0 && dateKey) {
    const monthSet = new Set<string>();
    for (const row of rows) {
      const d = parseRowDate(row[dateKey]);
      if (d) monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const sorted = [...monthSet].sort().reverse();
    if (sorted[0]) {
      const [ly, lm] = sorted[0].split("-").map(Number);
      accumulate(ly, lm - 1);
      monthLabel = `${String(lm).padStart(2, "0")}/${ly}`;
    }
  }
  if (count === 0) throw new Error("Sem dados ERC válidos.");

  const avgMWh = sum / count;
  return {
    averageUnitCost: avgMWh / 1000,
    averageUnitCostMWh: avgMWh,
    totalPeriods: count,
    dateRange: { from: minDate, to: maxDate },
    month: monthLabel,
    source: "Excel",
  };
}

export async function calculateERCUnitCost(): Promise<ERCData> {
  try {
    return await fromRenApi();
  } catch (e) {
    console.warn("REN API failed, falling back to Excel:", e);
    return await fromExcelFallback();
  }
}
