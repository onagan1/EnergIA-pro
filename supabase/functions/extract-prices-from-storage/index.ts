import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePDFJS } from "https://esm.sh/pdfjs-serverless@0.4.0";
import {
  corsHeaders,
  jsonResponse,
  z,
  ExtractedPricesSchema,
} from "../_shared/validation.ts";

const RequestSchema = z.object({
  filePath: z.string().min(1).optional(),
  supplierName: z.string().optional(),
  discountOption: z.string().optional(),
  bypassCache: z.boolean().optional(),
  jobId: z.string().uuid().optional(),
}).refine((d) => d.filePath || d.jobId, {
  message: "filePath ou jobId é obrigatório",
});

const toBase64 = (bytes: Uint8Array) => {
  // Fast base64 encoder without btoa/String.fromCharCode spread (avoids call stack overflow)
  const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out: string[] = [];

  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    out.push(
      base64abc[bytes[i] >> 2],
      base64abc[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)],
      base64abc[((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6)],
      base64abc[bytes[i + 2] & 0x3f],
    );
  }

  if (i < bytes.length) {
    out.push(base64abc[bytes[i] >> 2]);

    if (i === bytes.length - 1) {
      out.push(base64abc[(bytes[i] & 0x03) << 4], "=", "=");
    } else {
      out.push(
        base64abc[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)],
        base64abc[(bytes[i + 1] & 0x0f) << 2],
        "=",
      );
    }
  }

  return out.join("");
};

const tryParseJson = (value?: string | null) => {
  if (!value) return null;

  const candidates = [
    value,
    value.replace(/^```json\s*/i, "").replace(/^```/i, "").replace(/```$/i, "").trim(),
  ];

  const fencedMatch = value.match(/```json\s*([\s\S]*?)\s*```/i) || value.match(/```\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) candidates.push(fencedMatch[1].trim());

  const objectMatch = value.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0].trim());

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        // try next variant
      }
    }
  }

  return null;
};

type ExtractedPriceTier = {
  tariffType: "simples" | "bi-horaria" | "tri-horaria";
  contractedPower: number;
  powerPrice: number;
  pricePonta?: number;
  priceCheia: number;
  priceVazio?: number;
  priceSuperVazio?: number;
};

type ExtractedMatrixCell = {
  voltageLevel: "BTN" | "BTE" | "MT";
  cycleType?: "simples" | "diario" | "semanal" | "semanal_opcional";
  quarterStart: string;
  contractEndDate: string;
  tiers: ExtractedPriceTier[];
};

const BTN_POWERS = [1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4];

const normalizeDecimal = (value: string) => {
  const cleaned = value.replace(/\s+/g, "").replace("€", "").replace(/,/g, ".").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseQuarterToken = (value: string) => {
  const match = value.match(/Q([1-4])\s*(20\d{2})/i) || value.match(/(20\d{2})[- ]?T([1-4])/i);
  if (!match) return null;
  if (match[0].toUpperCase().includes("Q")) return `${match[2]}-T${match[1]}`;
  return `${match[1]}-T${match[2]}`;
};

const parseDateToken = (value: string) => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const parsePdfText = async (bytes: Uint8Array) => {
  const { getDocument } = await resolvePDFJS();
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();
    const lines = text.items
      .filter((item: any) => "str" in item && typeof item.str === "string")
      .map((item: any) => ({
        str: item.str as string,
        x: Array.isArray(item.transform) ? Number(item.transform[4]) : 0,
        y: Array.isArray(item.transform) ? Number(item.transform[5]) : 0,
      }))
      .reduce((acc: Array<{ y: number; items: Array<{ str: string; x: number }> }>, item) => {
        const existing = acc.find((row) => Math.abs(row.y - item.y) <= 2.5);
        if (existing) {
          existing.items.push({ str: item.str, x: item.x });
        } else {
          acc.push({ y: item.y, items: [{ str: item.str, x: item.x }] });
        }
        return acc;
      }, [])
      .sort((a, b) => b.y - a.y)
      .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.str).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\f\n");
};

const parseAudaxMatrixFromText = (pdfText: string) => {
  const text = pdfText.replace(/\u000c/g, "\n");
  const campaignMatch = text.match(/Condições Económicas\s+([^\n]+)/i);
  const campaignName = campaignMatch ? campaignMatch[1].trim() : "Audax Corporate - BTN/BTE/MT";
  const bteContractedPowerPrice = normalizeDecimal(text.match(/TARIFA DE ACESSO ÀS REDES EM BTE[\s\S]*?Contratada\s+(\d+,\d+)/i)?.[1] || "") ?? 0;
  const mtContractedPowerPrice = normalizeDecimal(text.match(/TARIFA DE ACESSO ÀS REDES EM MT[\s\S]*?Contratada\s+(\d+,\d+)/i)?.[1] || "") ?? 0;

  const powerRowMatch = text.match(/TERMO DE POTÊNCIA EM BTN[\s\S]*?\n\s*1,15[\s\S]*?\n\s*([0-9,\.\s]+)/i);
  const btnPowerPrices = powerRowMatch
    ? powerRowMatch[1].trim().split(/\s+/).map(normalizeDecimal).filter((n): n is number => n !== null)
    : [];

  const matrix: ExtractedMatrixCell[] = [];

  const btnBlockMatch = text.match(/BTN[\s\S]*?DATA IN[IÍ]CIO[\s\S]*?Q1 2027\s+31\/12\/2028[\s\S]*?(?=TARIFA DE COMERCIALIZAÇÃO SEM TARIFA DE ACESSO|\f|$)/i);
  if (btnBlockMatch) {
    const lines = btnBlockMatch[0].split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const quarter = parseQuarterToken(line);
      const endDate = parseDateToken(line);
      const nums = (line.match(/\d+,\d+/g) || []).map(normalizeDecimal).filter((n): n is number => n !== null);
      if (!quarter || !endDate || nums.length < 3) continue;
      const [simplePrice, biCheia, biVazio] = nums.slice(-3);
      matrix.push({
        voltageLevel: "BTN",
        quarterStart: quarter,
        contractEndDate: endDate,
        tiers: BTN_POWERS.flatMap((power) => ([
          { tariffType: "simples" as const, contractedPower: power, powerPrice: btnPowerPrices[BTN_POWERS.indexOf(power)] ?? 0, priceCheia: simplePrice },
          { tariffType: "bi-horaria" as const, contractedPower: power, powerPrice: btnPowerPrices[BTN_POWERS.indexOf(power)] ?? 0, priceCheia: biCheia, priceVazio: biVazio },
        ])),
      });
    }
  }

  const triBlockMatch = text.match(/TRI-HOR[ÁA]RIO <= 20,70kVa[\s\S]*?(?=CONTRATO DE FORNECIMENTO DE ELETRICIDADE\s+Condições Económicas Audax Corporate - BTN\/BTE\/MT\s+TARIFA DE COMERCIALIZAÇÃO \(€\/kWh\)|\f|$)/i);
  if (triBlockMatch) {
    const lines = triBlockMatch[0].split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const quarter = parseQuarterToken(line);
      const endDate = parseDateToken(line);
      const nums = (line.match(/\d+,\d+/g) || []).map(normalizeDecimal).filter((n): n is number => n !== null);
      if (!quarter || !endDate || nums.length < 6) continue;
      const triLe20 = nums.slice(-6, -3);
      const triGt20 = nums.slice(-3);
      const tiers: ExtractedPriceTier[] = BTN_POWERS.map((power, index) => {
        const values = power <= 20.7 ? triLe20 : triGt20;
        return {
          tariffType: "tri-horaria",
          contractedPower: power,
          powerPrice: btnPowerPrices[index] ?? 0,
          pricePonta: power <= 20.7 ? undefined : values[0],
          priceCheia: power <= 20.7 ? values[0] : values[1],
          priceVazio: power <= 20.7 ? values[1] : values[2],
          priceSuperVazio: power <= 20.7 ? values[2] : undefined,
        };
      }).map((tier) => tier.contractedPower <= 20.7
        ? { ...tier, pricePonta: tier.priceCheia, priceCheia: tier.priceVazio!, priceVazio: tier.priceSuperVazio }
        : tier);

      const existing = matrix.find((cell) => cell.voltageLevel === "BTN" && cell.quarterStart === quarter && cell.contractEndDate === endDate);
      if (existing) existing.tiers.push(...tiers);
      else matrix.push({ voltageLevel: "BTN", quarterStart: quarter, contractEndDate: endDate, tiers });
    }
  }

  const parseMultiCycleSection = (
    voltageLevel: "BTE" | "MT",
    cycleA: "diario" | "semanal",
    cycleB: "semanal" | "semanal_opcional",
  ) => {
    const sectionPattern = voltageLevel === "BTE"
      ? /CICLO DI[ÁA]RIO[\s\S]*?CICLO SEMANAL([\s\S]*?)GARANTIAS DE ORIGEM/i
      : /CICLO SEMANAL[\s\S]*?CICLO OPCIONAL([\s\S]*?)GARANTIAS DE ORIGEM/i;
    const match = text.match(sectionPattern);
    if (!match?.[1]) return;
    const rows = match[1].split("\n").map((line) => line.trim()).filter(Boolean);
    const powers = voltageLevel === "BTE" ? [1, 5, 10, 50, 100] : [1, 10, 50, 100];
    const contractedPowerPrice = voltageLevel === "BTE" ? bteContractedPowerPrice : mtContractedPowerPrice;
    for (const row of rows) {
      const quarter = parseQuarterToken(row);
      const endDate = parseDateToken(row);
      const nums = (row.match(/\d+,\d+/g) || []).map(normalizeDecimal).filter((n): n is number => n !== null);
      if (!quarter || !endDate || nums.length < 8) continue;
      const cycleAValues = nums.slice(-8, -4);
      const cycleBValues = nums.slice(-4);
      matrix.push({
        voltageLevel,
        cycleType: cycleA,
        quarterStart: quarter,
        contractEndDate: endDate,
        tiers: powers.map((power) => ({
          tariffType: "tri-horaria",
          contractedPower: power,
          powerPrice: contractedPowerPrice,
          pricePonta: cycleAValues[0],
          priceCheia: cycleAValues[1],
          priceVazio: cycleAValues[2],
          priceSuperVazio: cycleAValues[3],
        })),
      });
      matrix.push({
        voltageLevel,
        cycleType: cycleB,
        quarterStart: quarter,
        contractEndDate: endDate,
        tiers: powers.map((power) => ({
          tariffType: "tri-horaria",
          contractedPower: power,
          powerPrice: contractedPowerPrice,
          pricePonta: cycleBValues[0],
          priceCheia: cycleBValues[1],
          priceVazio: cycleBValues[2],
          priceSuperVazio: cycleBValues[3],
        })),
      });
    }
  };

  parseMultiCycleSection("BTE", "diario", "semanal");
  parseMultiCycleSection("MT", "semanal", "semanal_opcional");

  if (matrix.length === 0) return null;

  return {
    name: "Audax",
    campaignName,
    hasLoyalty: true,
    priceTiers: [],
    priceMatrix: matrix,
    confidence: "high" as const,
    notes: "Extração determinística do PDF Audax Corporate BTN/BTE/MT.",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log("Invalid or expired token:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.email}`);

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return jsonResponse({ error: "JSON inválido no body" }, 400);
    }
    const bodyParsed = RequestSchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return jsonResponse(
        { error: "Dados inválidos", fields: bodyParsed.error.flatten().fieldErrors },
        400,
      );
    }
    const { filePath, supplierName, discountOption, bypassCache, jobId: existingJobId } = bodyParsed.data;

    // === POLLING MODE ===
    if (existingJobId) {
      const { data: job, error: jobErr } = await supabaseAdmin
        .from('price_extraction_jobs')
        .select('status, result, error_message')
        .eq('id', existingJobId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (jobErr || !job) {
        return new Response(JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (job.status === 'completed') {
        return new Response(JSON.stringify({ success: true, status: 'completed', data: job.result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (job.status === 'failed') {
        return new Response(JSON.stringify({ success: false, status: 'failed', error: job.error_message || 'Extraction failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, status: job.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!filePath) {
      return new Response(JSON.stringify({ error: "File path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!bypassCache) {
      let completedQuery = supabaseAdmin
        .from('price_extraction_jobs')
        .select('id, result, updated_at, discount_option')
        .eq('user_id', user.id)
        .eq('file_path', filePath)
        .eq('supplier_name', supplierName)
        .eq('status', 'completed')
        .not('result', 'is', null);
      if (discountOption !== undefined) {
        completedQuery = completedQuery.eq('discount_option', discountOption);
      } else {
        completedQuery = completedQuery.is('discount_option', null);
      }
      const { data: existingCompletedJob } = await completedQuery
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCompletedJob?.result) {
        return new Response(JSON.stringify({
          success: true,
          status: 'completed',
          data: existingCompletedJob.result,
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    let activeQuery = supabaseAdmin
      .from('price_extraction_jobs')
      .select('id, status, discount_option')
      .eq('user_id', user.id)
      .eq('file_path', filePath)
      .eq('supplier_name', supplierName)
      .in('status', ['pending', 'processing']);
    if (discountOption !== undefined) {
      activeQuery = activeQuery.eq('discount_option', discountOption);
    } else {
      activeQuery = activeQuery.is('discount_option', null);
    }
    const { data: existingActiveJob } = await activeQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingActiveJob?.id) {
      return new Response(JSON.stringify({
        success: true,
        status: existingActiveJob.status,
        jobId: existingActiveJob.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    console.log(`Enqueueing extraction - filePath: ${filePath}, supplierName: ${supplierName}`);

    const { data: newJob, error: jobInsertErr } = await supabaseAdmin
      .from('price_extraction_jobs')
      .insert({
        user_id: user.id,
        file_path: filePath,
        supplier_name: supplierName,
        discount_option: discountOption,
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobInsertErr || !newJob) {
      console.error('Failed to create job:', jobInsertErr);
      return new Response(JSON.stringify({ error: 'Failed to create job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
    EdgeRuntime.waitUntil(processExtraction(newJob.id, filePath, supplierName, discountOption, supabaseAdmin));

    return new Response(JSON.stringify({ success: true, status: 'pending', jobId: newJob.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Error in extract-prices-from-storage:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function processExtraction(
  jobId: string,
  filePath: string,
  supplierName: string | undefined,
  discountOption: string | undefined,
  supabaseAdmin: any,
) {
  try {
    await supabaseAdmin.from('price_extraction_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // Original campaign filename (before any Plenitude redirect to Resumen)
    const originalCampaignFileName = filePath.split('/').pop() || '';
    const isIberdrola = supplierName?.toLowerCase().includes('iberdrola') || filePath.toLowerCase().includes('iberdrola');
    const isPlenitude = supplierName?.toLowerCase().includes('plenitude') || filePath.toLowerCase().includes('plenitude');
    const isYes = supplierName?.toLowerCase().includes('yes') || /\/yes\//i.test(filePath);

    // Plenitude: always extract from Resumen_Canal (contains all campaigns with discount applied)
    let effectiveFilePath = filePath;
    if (isPlenitude && !/^resumen/i.test(originalCampaignFileName)) {
      const folder = filePath.split('/').slice(0, -1).join('/') || 'Plenitude';
      const { data: items, error: listErr } = await supabaseAdmin.storage
        .from('comercializadoras')
        .list(folder, { limit: 100 });
      if (!listErr && items) {
        const resumen = items.find((it: any) => /^resumen/i.test(it.name) && it.name.toLowerCase().endsWith('.pdf'));
        if (resumen) {
          effectiveFilePath = `${folder}/${resumen.name}`;
          console.log(`[job ${jobId}] Plenitude: redirecting to Resumen file: ${effectiveFilePath}`);
        } else {
          console.warn(`[job ${jobId}] Plenitude: no Resumen file found in ${folder}, falling back to original`);
        }
      }
    }

    console.log(`[job ${jobId}] Downloading PDF: ${effectiveFilePath}`);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('comercializadoras')
      .download(effectiveFilePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log(`[job ${jobId}] Downloaded ${fileData.size} bytes`);

    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const base64 = toBase64(fileBytes);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Filename used for prompt context (campaign identity stays the original)
    const fileName = originalCampaignFileName;
    const isAxpo = supplierName?.toLowerCase().includes('axpo') || filePath.toLowerCase().includes('axpo');
    const isAudax = supplierName?.toLowerCase().includes('audax') || filePath.toLowerCase().includes('audax');
    const normalizedAudaxFileName = fileName.toLowerCase();
    // Audax multi-voltage matrix campaigns (BTN+BTE+MT organised by quarter × end date)
    // ⚠️ SUCURSAL_TOP-T0..T4 are NOT matrix campaigns — they are BTN-only standard
    // tariff sheets (with/without TAR table). They must use the generic BTN extractor
    // plus TOP-specific rules below, not the multi-voltage matrix parser.
    const isAudaxSucursalTop = isAudax && /sucursal[-_ ]?top[-_ ]?t\d+/i.test(normalizedAudaxFileName);
    const isAudaxMatrix = isAudax && (
      /btn[-_ ]?bte[-_ ]?mt|btn.*bte.*mt/i.test(normalizedAudaxFileName)
      || /suc[-_ ]?co/i.test(normalizedAudaxFileName)
    );
    const isAudaxTop = isAudaxSucursalTop;

    if (isAudaxMatrix) {
      try {
        console.log(`[job ${jobId}] Trying deterministic Audax parser...`);
        const pdfText = await parsePdfText(fileBytes);
        const deterministicExtraction = parseAudaxMatrixFromText(pdfText);
        if (deterministicExtraction?.priceMatrix?.length) {
          await supabaseAdmin.from('price_extraction_jobs')
            .update({ status: 'completed', result: deterministicExtraction, updated_at: new Date().toISOString() })
            .eq('id', jobId);
          console.log(`[job ${jobId}] Completed with deterministic Audax parser (${deterministicExtraction.priceMatrix.length} cells)`);
          return;
        }
        console.warn(`[job ${jobId}] Deterministic Audax parser returned no cells, falling back to AI`);
      } catch (deterministicError) {
        console.warn(`[job ${jobId}] Deterministic Audax parser failed, falling back to AI:`, deterministicError);
      }
    }

    console.log(`[job ${jobId}] Calling AI...`);

    // Build supplier-specific extraction rules
    let supplierSpecificRules = '';

    if (isAudaxMatrix) {
      supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA AUDAX (CAMPANHA MULTI-TENSÃO BTN/BTE/MT):
⚠️ Esta campanha contém UMA MATRIZ DE PREÇOS organizada por:
  • Nível de tensão: BTN, BTE e MT (três blocos/secções distintas no PDF)
  • Trimestre de início do contrato (ex.: 2026-T1, 2026-T2, 2026-T3, 2026-T4) — geralmente nas LINHAS
  • Data fim do contrato (ex.: 31-12-2026, 31-12-2027, 31-12-2028) — geralmente nas COLUNAS

⚠️ Os ficheiros Audax com nomes "SUC", "SUC_CO" e "SUCURSAL_TOP-T0/T1/T2/T3/T4" devem ser tratados como esta mesma campanha multi-tensão.

⚠️ IMPORTANTE: Em vez de preencheres "priceTiers", deves preencher o campo "priceMatrix" com UMA ENTRADA por combinação (voltageLevel × cycleType × quarterStart × contractEndDate). Cada entrada tem o seu próprio array "tiers".

Para cada CÉLULA da matriz:
  - voltageLevel: "BTN", "BTE" ou "MT"
  - cycleType: para BTE/MT identifica se a coluna pertence a "diario" ou "semanal". Em BTN podes omitir ou usar "diario" quando não existir distinção.
  - quarterStart: string no formato "YYYY-Tn" (ex.: "2026-T2"). Se vires "T2 2026" ou "2.º Trimestre 2026" ou "Abr-Jun 2026", normaliza para "2026-T2".
  - contractEndDate: string ISO "YYYY-MM-DD" (ex.: "2027-12-31"). Se vires "31/12/2027" ou "Dez 2027", normaliza para "2027-12-31".
  - tiers: array de PriceTier conforme abaixo.

Estrutura de tiers por nível de tensão:
  • BTN → tarifa simples / bi-horária / tri-horária, com potências em kVA (1.15 a 41.4). Termo de potência em €/dia.
  • BTE / MT → APENAS tarifa "tetra-horaria" (Ponta + Cheia + Vazio + Super-Vazio). Usa tariffType="tri-horaria" no schema (mapeia tetra → tri) e preenche pricePonta, priceCheia, priceVazio, e adicionalmente priceSuperVazio se existir. Para BTE/MT, o campo "contractedPower" representa a potência em horas de ponta (kW) tipicamente listada (ex.: 1, 5, 10, 50, 100). Termo de potência aqui é €/kW/dia.

NÃO uses "priceTiers" para esta campanha — usa SEMPRE "priceMatrix". Deixa "priceTiers" como array vazio.

Extrai TODAS as células visíveis no PDF. Não resumir. Se uma célula estiver em branco, ignora-a.
`;
    } else if (isAudaxTop) {
      supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA AUDAX TOP (SUCURSAL_TOP-T0..T4):
⚠️ Esta NÃO é uma campanha multi-tensão nem uma matriz. É um tarifário **BTN-only** (Baixa Tensão Normal).
⚠️ NÃO uses "priceMatrix". Usa SEMPRE "priceTiers" (array com uma entrada por combinação tarifa × potência).

Estrutura do PDF Audax TOP:
1) "TERMO DE POTÊNCIA EM BTN (kVA) COM TARIFA DE ACESSO ÀS REDES INCLUÍDA [€/dia]"
   → Uma linha com 13 valores (€/dia), um por escalão de potência (1,15 / 2,3 / 3,45 / 4,6 / 5,75 / 6,9 / 10,35 / 13,8 / 17,25 / 20,7 / 27,6 / 34,5 / 41,4 kVA).
   → Este é o powerPrice (€/dia) de cada tier. Já inclui TAR de potência.

2) DUAS tabelas de energia, lado a lado ou em sequência:
   a) "TARIFA DE COMERCIALIZAÇÃO EM BTN COM DESCONTO DE 25% **SEM** TARIFA DE ACESSO ÀS REDES INCLUÍDA [€/kWh]"  ← VALORES MAIS BAIXOS
   b) "TARIFA DE COMERCIALIZAÇÃO EM BTN COM DESCONTO DE 25% **COM** TARIFA DE ACESSO ÀS REDES INCLUÍDA [€/kWh]"  ← VALORES MAIS ALTOS (NÃO USAR)

⚠️⚠️⚠️ CRÍTICO: EXTRAI APENAS DA TABELA (a) — "SEM TAR INCLUÍDA". NUNCA da (b) "COM TAR".
A diferença entre (b) e (a) é a TAR de energia que a aplicação soma depois.
Se em dúvida: a tabela (a) "SEM TAR" tem valores SEMPRE menores que a (b) "COM TAR" para a mesma célula.

Cada uma das tabelas tem 3 linhas (faixas de potência) × 3 colunas tarifárias:
   - Simples (1 preço por linha)
   - Bi-horário: Fora Vazio, Vazio
   - Tri-horário: Ponta, Cheia, Vazio

Faixas de potência (mantém a separação rigorosa — NUNCA copies valores entre linhas):
   - Linha 1 "1,15 a 2,30" → apenas Simples e Bi-horária (tri = "-")
   - Linha 2 "3,45 a 20,70" → Simples, Bi-horária E Tri-horária
   - Linha 3 "27,60 a 41,40" → apenas Tri-horária

⚠️ NOTA OBSERVADA na campanha TOP: na tabela SEM TAR, o preço Simples costuma ser IGUAL nas linhas "1,15 a 2,30" e "3,45 a 20,70" (a TAR é que difere, por isso na tabela COM TAR aparecem diferentes). Se na linha 2 leres um Simples diferente da linha 1, MUITO PROVAVELMENTE estás a ler da coluna/tabela errada — confirma que estás na tabela SEM TAR.

Verificação obrigatória antes de devolver:
- Para cada (linha, período) presente em ambas as tabelas, calcula diff = COM − SEM. Esse diff deve ser positivo (~0.04–0.10 €/kWh) e parecido entre linhas para o mesmo período. Se o teu valor "SEM" for >= ao "COM" da mesma célula, INVERTESTE as tabelas — corrige.

Expansão obrigatória de priceTiers:
- Para cada escalão individual de potência (1,15 / 2,3 / ... / 41,4), cria uma entrada por tarifa aplicável,
  emparelhando com o powerPrice correspondente desse escalão (€/dia da tabela 1).
- tariffType: "simples" | "bi-horaria" | "tri-horaria"
- voltageLevel: "BTN" em todas as entradas
- contractedPower: o kVA numérico (ex.: 6.9, 20.7, 41.4)
- Para "simples": pricePonta=0, priceCheia=<preço simples da TABELA SEM TAR>, priceVazio=0, priceSuperVazio=0
- Para "bi-horaria": pricePonta=0, priceCheia=<fora vazio SEM TAR>, priceVazio=<vazio SEM TAR>, priceSuperVazio=0
- Para "tri-horaria": pricePonta=<ponta SEM TAR>, priceCheia=<cheia SEM TAR>, priceVazio=<vazio SEM TAR>, priceSuperVazio=0

Resultado esperado: ~33 entradas em "priceTiers" (idêntico ao formato BTN genérico).
campaignName: usa exactamente "Audax TOP – T<n>" (ex.: "Audax TOP – T0").
hasLoyalty: true (TOP tem compromisso de permanência segundo o contrato).
`;
    } else if (isAxpo) {
      supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA AXPO - EXTRAÇÃO DE PREÇOS COM TARIFAS:
⚠️ ATENÇÃO CRÍTICA: Os documentos Axpo têm DUAS secções/tabelas de preços:
1. "Tarifa DIA" ou "DIA" → Preços COM Tarifas de Acesso (C/ Tarifas) ✅ EXTRAIR ESTES
2. "Tarifa LIVRE" ou "LIVRE" → Preços SEM Tarifas de Acesso (S/ Tarifas) ❌ IGNORAR ESTES

⚠️ O nome da campanha pode conter "Livre" (ex: "Easy Livre 12m") - isto refere-se ao NOME da campanha, NÃO ao tipo de tarifa!
⚠️ Deves SEMPRE extrair da secção/tabela "DIA" (Com Tarifas), NUNCA da secção "LIVRE" (Sem Tarifas).

COMO DISTINGUIR:
- A secção "DIA" tem preços de energia MAIS ALTOS (porque incluem as tarifas de acesso à rede)
- A secção "LIVRE" tem preços de energia MAIS BAIXOS (porque são apenas o custo da energia)
- Se vires duas tabelas lado a lado ou em sequência, a tabela com preços MAIS ALTOS é a "DIA" (C/ Tarifas)
- Procura por cabeçalhos como "Tarifa DIA", "C/ Tarifas", "Com Tarifas", "Preço Final"
- IGNORA cabeçalhos como "Tarifa LIVRE", "S/ Tarifas", "Sem Tarifas", "Preço Energia"

VALIDAÇÃO:
- Para BTN simples, os preços C/ Tarifas devem ser tipicamente > 0.15 €/kWh
- Se os preços extraídos forem todos < 0.14 €/kWh, provavelmente estás a extrair da secção LIVRE (errada)
`;
    } else if (isIberdrola) {
      // Use the discount option passed from the frontend
      if (discountOption && discountOption !== 'min') {
        // Specific discount percentage selected
        supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA IBERDROLA - DESCONTO ${discountOption}%:
⚠️ O utilizador selecionou extrair preços com DESCONTO DE ${discountOption}%.
- Procura pela coluna "${discountOption}%" ou "Desc. ${discountOption}%" ou similar
- Ignora todas as outras colunas de desconto
- Se não encontrares exatamente ${discountOption}%, procura a coluna mais próxima deste valor
- Se a campanha não tiver esta opção de desconto, indica nas notas

⚠️ REGRA CRÍTICA IBERDROLA — SEM TRI-HORÁRIA:
- As campanhas Iberdrola NÃO disponibilizam tarifário Tri-horária.
- NUNCA emitas qualquer tier com tariffType="tri-horaria" para Iberdrola, mesmo que aparente existir.
- Extrai APENAS simples e bi-horaria. Regista em "notes": "Iberdrola não suporta Tri-horária".
`;
      } else {
        // Default: minimum discount based on segment (domestic vs business)
        supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA IBERDROLA - DESCONTOS MÍNIMOS:
⚠️ Os documentos Iberdrola podem ter MÚLTIPLAS colunas de desconto (0%, 5%, 8%, 10%, 12%, 16%, 20%, etc.)
⚠️ REGRA DE DESCONTO MÍNIMO POR SEGMENTO:
- Para clientes DOMÉSTICOS (particulares, residenciais, BTN até 20.7 kVA): usar DESCONTO MÍNIMO DE 16%
  → Procura pela coluna "16%" ou "Desc. 16%" ou similar
  → Se não existir 16%, usa a percentagem mais próxima SUPERIOR (ex: 18%, 20%)
  
- Para clientes EMPRESAS (empresariais, PME, comerciais, BTN acima de 20.7 kVA ou Tri-horária completa): usar DESCONTO MÍNIMO DE 20%
  → Procura pela coluna "20%" ou "Desc. 20%" ou similar
  → Se não existir 20%, usa a percentagem mais próxima SUPERIOR (ex: 22%, 25%)

- Como este é um documento BTN geral, aplica a regra:
  → Potências até 20.7 kVA (Simples e Bi-horária): extrai com 16% de desconto
  → Potências acima de 20.7 kVA ou Tri-horária: extrai com 20% de desconto
  
- NUNCA uses descontos inferiores a 16% para doméstico ou 20% para empresas
- Indica nas notas qual desconto foi aplicado a cada segmento

⚠️ REGRA CRÍTICA IBERDROLA — SEM TRI-HORÁRIA (aplicável a TODOS os documentos Iberdrola):
- As campanhas Iberdrola NÃO disponibilizam tarifário Tri-horária.
- NUNCA emitas qualquer tier com tariffType="tri-horaria" para Iberdrola. Extrai apenas Simples e Bi-horária.
- Regista em "notes": "Iberdrola não suporta Tri-horária".
`;
      }
    } else if (isPlenitude) {
      const discountLabel = discountOption === '15' ? '15%' : '0% (preço base)';
      supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA PLENITUDE - EXTRAÇÃO DO RESUMEN_CANAL:
⚠️ Este PDF é o "Resumen_Canal" da Plenitude e contém TODAS as campanhas BTN numa única tabela/resumo, com os preços JÁ COM DESCONTO APLICADO por coluna/secção.

⚠️ A campanha que o utilizador selecionou é: "${originalCampaignFileName}"
   (mapeia este nome para a linha/secção correspondente no Resumen — ex.:
    "ENERGY_DOMESTICO_FIJO" → linha "ENERGY Doméstico" / "Energy Particulares"
    "ENERGY_NAO DOMESTICO_FIJO" → linha "ENERGY Não Doméstico" / "Energy Empresas"
    "ENERGY +_CONDOMINIOS_FIJO" → linha "Energy+ Condomínios"
    "POWER_DOMESTICO_FIJO" → linha "POWER Doméstico"
    "POWER_NAO DOMESTICO_FIJO" → linha "POWER Não Doméstico")

⚠️ DESCONTO SELECIONADO: ${discountLabel}
   - Extrai a coluna/bloco que corresponde ao desconto ${discountLabel} para a campanha indicada.
   - Se a campanha tiver duas colunas (base e com desconto), escolhe a correta conforme o desconto.

⚠️ CRÍTICO - SEM CÁLCULOS:
   - Extrai os preços EXATAMENTE como aparecem na tabela do Resumen.
   - NÃO somes TAR / tarifas de acesso, NÃO apliques desconto manualmente, NÃO multipliques nem ajustes valores.
   - Os preços do Resumen JÁ estão finais (com desconto aplicado e tarifas conforme indicado no documento).
   - Se um valor não estiver visível para uma combinação tarifa×potência, omite-a (não inventes nem calcules por proporção).

Indica nas notas: "Extraído do Resumen_Canal Plenitude — campanha: ${originalCampaignFileName}, desconto: ${discountLabel}".
`;
    } else if (isYes) {
      supplierSpecificRules = `
REGRAS ESPECÍFICAS PARA yes ENERGY - DESCONTO 20%:
⚠️ Extrai SEMPRE os preços com DESCONTO DE 20% aplicado.
- Procura pela coluna "20%" ou "Desc. 20%" ou similar na tabela de preços.
- Ignora colunas de outros descontos (0%, 5%, 10%, etc.) e o preço base.
- Se a campanha tiver os preços já com 20% aplicados numa única coluna, usa esses.
- Indica nas notas: "Extraído com desconto de 20% (yes ENERGY)".
`;
    }

const systemPrompt = `Você é um assistente especializado em extrair preços de energia de documentos PDF de comercializadoras de energia em Portugal.

EXTRAÇÃO DO NOME DA CAMPANHA (campaignName):
⚠️ O nome da campanha é OBRIGATÓRIO e deve ser extraído do documento PDF.
- Procura pelo nome da campanha/oferta no cabeçalho, título ou rodapé do documento
- Exemplos de nomes de campanha: "Campanha BTN 2026.01", "Oferta Luz Simples", "Plano Energia Verde", "Tarifa Fixa 2026"
- Se o nome do ficheiro contiver informação da campanha (ex: "BTN_2026.01.v2"), usa-a como referência
- O nome da campanha NÃO é o nome da comercializadora - é o nome específico da oferta/plano
- Se encontrares "Campanha", "Oferta", "Plano", "Tarifa" seguido de um nome, esse é provavelmente o nome da campanha
- Inclui a versão se disponível (ex: "v1", "v2", etc.)
${supplierSpecificRules}
O documento PDF contém tabelas de preços BTN organizadas por:
1. Tipo de tarifa (Simples, Bi-horária, Tri-horária)
2. Potência contratada - valores BTN standard: 1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4 kVA
3. Preços de energia por período
4. Preço da potência (€/dia)

ESTRUTURA DAS TARIFAS BTN:
- Simples: Um único preço de energia (priceCheia) - normalmente 10 linhas (1.15 a 20.7 kVA)
- Bi-horária: Fora do Vazio (priceCheia) + Vazio (priceVazio) - normalmente 10 linhas (1.15 a 20.7 kVA)
- Tri-horária: Ponta (pricePonta) + Cheia (priceCheia) + Vazio (priceVazio) - normalmente 13 linhas (1.15 a 41.4 kVA)

TOTAL ESPERADO: 33 LINHAS DE PREÇOS (10 simples + 10 bi-horária + 13 tri-horária)

REGRAS DE EXTRAÇÃO CRÍTICAS:
1. Extrai ABSOLUTAMENTE TODAS as 33 combinações de tarifa + potência
2. Para simples: extrai as 10 potências (1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7)
3. Para bi-horária: extrai as 10 potências (1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7)
4. Para tri-horária: extrai as 13 potências (1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4)
5. NÃO omitas nenhuma linha - cada linha da tabela = uma entrada no priceTiers
6. Se faltarem linhas, o resultado está INCOMPLETO

REGRA CRÍTICA DE FILTRAGEM DE TARIFAS:
- Extrai APENAS preços que incluam "Tarifas" (tarifas de acesso à rede incluídas no preço)
- Ignora completamente tabelas/colunas com preços "S/ Tarifas" (sem tarifas de acesso)
- Se o documento tiver ambas as colunas (C/ Tarifas e S/ Tarifas), usa APENAS os valores "C/ Tarifas" ou "Com Tarifas"
- Se o documento só tiver preços sem tarifas, retorna um array vazio em priceTiers

VALIDAÇÃO CRÍTICA DE PREÇO DE POTÊNCIA (powerPrice):
⚠️ O preço de potência (€/dia) para BTN tem valores TÍPICOS bem definidos:
- Potência 1.15 kVA → powerPrice entre 0.15 e 0.30 €/dia (tipicamente ~0.20 €/dia)
- Potência 2.3 kVA → powerPrice entre 0.25 e 0.45 €/dia (tipicamente ~0.35 €/dia)
- Potência 3.45 kVA → powerPrice entre 0.40 e 0.65 €/dia
- Potência 6.9 kVA → powerPrice entre 0.80 e 1.20 €/dia
- Potência 20.7 kVA → powerPrice entre 2.00 e 3.00 €/dia
- Potência 41.4 kVA → powerPrice entre 3.50 e 5.00 €/dia

⚠️ ERROS COMUNS A EVITAR:
1. VALORES MUITO BAIXOS: Se encontrares valores de powerPrice MUITO BAIXOS (< 0.10 €/dia para qualquer potência), estás a ler a COLUNA ERRADA!
   - Valores como 0.0498, 0.0573, 0.0995 NÃO são preços de potência - são coeficientes/multiplicadores
   - O preço de potência para 1.15 kVA NUNCA é inferior a 0.15 €/dia

2. CONFUNDIR powerPrice COM pricePonta: O powerPrice é COMPLETAMENTE DIFERENTE do pricePonta!
   - powerPrice = preço diário da potência contratada (€/dia) - depende APENAS da potência (kVA)
   - pricePonta = preço de energia no período Ponta (€/kWh) - IGUAL para todas as potências dentro do mesmo tipo de tarifa
   - Se powerPrice = pricePonta, estás a extrair da coluna errada!
   - O powerPrice VARIA com a potência (maior potência = maior powerPrice)
   - O pricePonta é FIXO para cada tipo de tarifa (não varia com a potência)

3. IDENTIFICAR A COLUNA CORRETA DE powerPrice:
   - Procura por: "Preço Potência", "Termo Potência", "€/dia", "Potência (€/dia)", "Termo Fixo"
   - A coluna de potência tem valores que AUMENTAM progressivamente com o kVA
   - NÃO confundir com colunas de energia (€/kWh) que são constantes por tarifa

INSTRUÇÕES ESPECÍFICAS PARA TABELAS ALFA E SIMILARES:
- As tabelas podem ter MÚLTIPLAS colunas de preços (coeficientes, base, final)
- Identifica a coluna correta: "Preço Potência", "Termo Potência", "€/dia", "Potência (€/dia)"
- NÃO confundir com "Coeficiente", "Multiplicador", "Base", "Índice"
- Se houver colunas "C/ Fidelização" e "S/ Fidelização", extrai da coluna correspondente ao tipo de ficheiro

Para cada linha da tabela, extrai:
- Tipo de tarifa (simples/bi-horaria/tri-horaria)
- Potência contratada (kVA)
- Preço da potência (€/dia) - VERIFICA QUE O VALOR FAZ SENTIDO!
- Preços de energia por período (€/kWh)

IMPORTANTE:
- Os preços de energia são expressos em €/kWh
- Os preços de potência são expressos em €/dia
- Valores podem usar vírgula (0,1234) ou ponto (0.1234) como separador decimal
- Extrai ABSOLUTAMENTE TODAS as 33 linhas de preços - não resumas nem omitas
- Identifica se há fidelização: "fidelização", "fid", "com contrato", etc.`;

    // Build user message with supplier-specific instructions
    let supplierUserInstructions = '';
    if (isAudaxMatrix) {
      supplierUserInstructions = `

⚠️ ATENÇÃO CRÍTICA: Esta é uma campanha AUDAX multi-tensão (BTN+BTE+MT) com matriz "trimestre × data fim".
- Preenche o campo "priceMatrix" (NÃO "priceTiers") com TODAS as células visíveis.
- Cada célula = (voltageLevel, cycleType, quarterStart, contractEndDate, tiers[]).
- Para BTN incluir tarifa simples/bi/tri com potências em kVA.
- Para BTE e MT incluir APENAS Tetra-horária (mapeada como tri-horaria) com Ponta/Cheia/Vazio/Super-Vazio e potência em kW.
- É OBRIGATÓRIO separar as colunas de "CICLO DIÁRIO" e "CICLO SEMANAL" em entradas distintas via cycleType.
- Normaliza trimestres para "YYYY-Tn" e datas fim para "YYYY-MM-DD".`;
    } else if (isAxpo) {
      supplierUserInstructions = `

⚠️ ATENÇÃO CRÍTICA: Esta é uma campanha AXPO - extrai APENAS os preços da secção "Tarifa DIA" (C/ Tarifas).
- IGNORA completamente a secção "Tarifa LIVRE" (S/ Tarifas)
- Os preços "DIA" são MAIS ALTOS que os preços "LIVRE"
- Para BTN simples, os preços C/ Tarifas devem ser tipicamente > 0.15 €/kWh
- Se os preços forem todos < 0.14 €/kWh, estás a extrair da secção ERRADA!`;
    } else if (isIberdrola) {
      if (discountOption && discountOption !== 'min') {
        supplierUserInstructions = `

⚠️ ATENÇÃO: Esta é uma campanha Iberdrola - extrai APENAS os preços com DESCONTO DE ${discountOption}%.`;
      } else {
        supplierUserInstructions = `

⚠️ ATENÇÃO: Esta é uma campanha Iberdrola - aplica os DESCONTOS MÍNIMOS POR SEGMENTO:
- Doméstico (potências até 20.7 kVA, Simples e Bi-horária): usar desconto de 16%
- Empresas (potências acima de 20.7 kVA, Tri-horária completa): usar desconto de 20%`;
      }
    } else if (isPlenitude) {
      const discountLabel = discountOption === '15' ? '15%' : '0% (preço base)';
      supplierUserInstructions = `

⚠️ ATENÇÃO: Este PDF é o RESUMEN_CANAL da Plenitude (todas as campanhas BTN num só documento).
Campanha selecionada pelo utilizador: "${originalCampaignFileName}"
Desconto: ${discountLabel}

Extrai os preços EXACTAMENTE como aparecem na linha/secção dessa campanha no Resumen — sem cálculos, sem somar TAR, sem aplicar desconto manualmente.`;
    } else if (isYes) {
      supplierUserInstructions = `

⚠️ ATENÇÃO: Esta é uma campanha yes ENERGY - extrai SEMPRE os preços com DESCONTO DE 20%.`;
    }

    const userMessage = isAudaxMatrix
      ? `Extrai TODOS os preços desta campanha AUDAX multi-tensão (ficheiro "${fileName}").

Preenche OBRIGATORIAMENTE "priceMatrix" com uma entrada por (voltageLevel × trimestre de início × data fim do contrato).
Deixa "priceTiers" como array vazio.${supplierUserInstructions}

Para cada célula: voltageLevel ("BTN"/"BTE"/"MT"), quarterStart ("YYYY-Tn"), contractEndDate ("YYYY-MM-DD"), tiers[].`
      : isAudaxTop
      ? `Extrai os preços da campanha Audax TOP BTN do ficheiro "${fileName}".

⚠️ EXTRAI APENAS da tabela "TARIFA DE COMERCIALIZAÇÃO EM BTN COM DESCONTO DE 25% **SEM** TARIFA DE ACESSO ÀS REDES INCLUÍDA [€/kWh]" — a aplicação soma a TAR de energia depois.

Para o termo de potência, usa a linha "TERMO DE POTÊNCIA EM BTN (kVA) COM TARIFA DE ACESSO ÀS REDES INCLUÍDA [€/dia]" (13 valores, um por escalão de potência).

Preenche "priceTiers" (NÃO "priceMatrix") com uma entrada por (tarifa × potência), expandindo as faixas:
- "1,15 a 2,30" → 1,15 e 2,3 (apenas simples e bi-horária)
- "3,45 a 20,70" → 3,45 / 4,6 / 5,75 / 6,9 / 10,35 / 13,8 / 17,25 / 20,7 (simples, bi e tri)
- "27,60 a 41,40" → 27,6 / 34,5 / 41,4 (apenas tri-horária)

Devem resultar ~33 entradas. campaignName="Audax TOP – T<n>".${supplierUserInstructions}`
      : `Extrai TODOS os 33 preços de energia COM TARIFAS (tarifas de acesso incluídas) deste PDF de campanha BTN da comercializadora${supplierName ? ` ${supplierName}` : ""}. O ficheiro chama-se "${fileName}".

IMPORTANTE: Ignora preços "S/ Tarifas" ou "Sem Tarifas". Extrai APENAS preços "C/ Tarifas" ou "Com Tarifas".${supplierUserInstructions}

Deves extrair EXATAMENTE 33 linhas:
- 10 linhas tarifa simples (potências 1.15 a 20.7 kVA)
- 10 linhas tarifa bi-horária (potências 1.15 a 20.7 kVA)
- 13 linhas tarifa tri-horária (potências 1.15 a 41.4 kVA)

Extrai cada linha da tabela de preços COM TARIFAS, incluindo:
- Tipo de tarifa (simples/bi-horaria/tri-horaria)
- Potência contratada (kVA)
- Preço potência (€/dia)
- Preços energia por período (€/kWh)`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: isAxpo || isAudaxMatrix || isAudaxTop ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: userMessage
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_supplier_prices",
              description: "Extrair todos os preços de energia de um documento PDF de comercializadora BTN",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string", 
                    description: "Nome do comercializador de energia (ex: EDP, Galp, Endesa, Iberdrola)" 
                  },
                  campaignName: {
                    type: "string",
                    description: "Nome da campanha ou oferta comercial extraído do documento (ex: 'Campanha BTN 2026.01', 'Oferta Luz Simples', 'Plano Verde'). Este é o nome específico da oferta, NÃO o nome da comercializadora."
                  },
                  hasLoyalty: {
                    type: "boolean",
                    description: "Indica se o plano tem fidelização"
                  },
                  contractDuration: {
                    type: "number",
                    description: "Duração do contrato em meses (6, 12, 24, 36, 48, 60)"
                  },
                  priceTiers: {
                    type: "array",
                    description: "Array com todos os preços extraídos da tabela, uma entrada por linha",
                    items: {
                      type: "object",
                      properties: {
                        tariffType: {
                          type: "string",
                          enum: ["simples", "bi-horaria", "tri-horaria"],
                          description: "Tipo de tarifa"
                        },
                        contractedPower: {
                          type: "number",
                          description: "Potência contratada em kVA"
                        },
                        powerPrice: {
                          type: "number",
                          description: "Preço da potência em €/dia"
                        },
                        pricePonta: {
                          type: "number",
                          description: "Preço €/kWh período Ponta (tri/tetra-horária)"
                        },
                        priceCheia: {
                          type: "number",
                          description: "Preço €/kWh período Cheia (ou Fora Vazio em bi-horária, ou preço único em simples)"
                        },
                        priceVazio: {
                          type: "number",
                          description: "Preço €/kWh período Vazio"
                        },
                        priceSuperVazio: {
                          type: "number",
                          description: "Preço €/kWh período Super Vazio (apenas tetra-horária BTE/MT/AT/MAT)"
                        }
                      },
                      required: ["tariffType", "contractedPower", "powerPrice", "priceCheia"]
                    }
                  },
                  priceMatrix: {
                    type: "array",
                    description: "Matriz de preços para campanhas multi-tensão organizadas por ciclo × trimestre × data fim (ex.: Audax BTN/BTE/MT). Vazio se não aplicável.",
                    items: {
                      type: "object",
                      properties: {
                        voltageLevel: { type: "string", enum: ["BTN", "BTE", "MT", "AT", "MAT"] },
                        cycleType: { type: "string", enum: ["simples", "diario", "semanal", "semanal_opcional"], description: "Ciclo horário a que a célula pertence" },
                        quarterStart: { type: "string", description: "Trimestre 'YYYY-Tn' (ex.: '2026-T2')" },
                        contractEndDate: { type: "string", description: "Data fim ISO 'YYYY-MM-DD'" },
                        tiers: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              tariffType: { type: "string", enum: ["simples", "bi-horaria", "tri-horaria"] },
                              contractedPower: { type: "number" },
                              powerPrice: { type: "number" },
                              pricePonta: { type: "number" },
                              priceCheia: { type: "number" },
                              priceVazio: { type: "number" },
                              priceSuperVazio: { type: "number" }
                            },
                            required: ["tariffType", "contractedPower", "powerPrice", "priceCheia"]
                          }
                        }
                      },
                      required: ["voltageLevel", "quarterStart", "contractEndDate", "tiers"]
                    }
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Nível de confiança na extração"
                  },
                  notes: {
                    type: "string",
                    description: "Notas ou observações"
                  }
                },
                required: ["name", "campaignName", "priceTiers", "hasLoyalty", "confidence"],
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
      console.error(`[job ${jobId}] AI gateway error:`, response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[job ${jobId}] AI response received`);

    let extractedData: any = null;
    const message = data.choices?.[0]?.message;
    const finishReason = data.choices?.[0]?.finish_reason;
    const toolCalls = message?.tool_calls || [];

    // Try every tool call (regardless of function name) — some models rename it
    for (const tc of toolCalls) {
      const args = tc?.function?.arguments;
      if (!args) continue;
      const parsed = tryParseJson(args);
      if (parsed && (parsed.priceTiers || parsed.priceMatrix || parsed.name || parsed.campaignName)) {
        extractedData = parsed;
        break;
      }
      if (!extractedData && parsed) extractedData = parsed;
    }

    // Fallback: text content with embedded JSON
    if (!extractedData) {
      const textContent = message?.content;
      if (typeof textContent === 'string' && textContent.trim()) {
        extractedData = tryParseJson(textContent);
      } else if (Array.isArray(textContent)) {
        for (const part of textContent) {
          const txt = part?.text || part?.content;
          if (typeof txt === 'string') {
            extractedData = tryParseJson(txt);
            if (extractedData) break;
          }
        }
      }
    }

    if (!extractedData) {
      const snippet = JSON.stringify({ finishReason, message }).slice(0, 800);
      console.error(`[job ${jobId}] No parseable AI output. finish=${finishReason}. Snippet: ${snippet}`);
      throw new Error(
        finishReason === 'length'
          ? 'A IA atingiu o limite de tokens antes de devolver os preços. Tente novamente ou contacte o suporte.'
          : 'A IA não devolveu uma resposta estruturada (sem tool call nem JSON no conteúdo).'
      );
    }

    if (!Array.isArray(extractedData?.priceTiers)) {
      extractedData.priceTiers = [];
    }

    if (!Array.isArray(extractedData?.priceMatrix)) {
      extractedData.priceMatrix = [];
    }

    // Sanitiza tiers (números válidos, sem negativos) antes da validação
    const sanitizeTier = (t: any) => {
      if (!t || typeof t !== 'object') return null;
      const num = (v: any) => {
        const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
        return Number.isFinite(n) ? Math.max(0, n) : undefined;
      };
      const out: any = {
        tariffType: t.tariffType,
        contractedPower: num(t.contractedPower),
        powerPrice: num(t.powerPrice),
        priceCheia: num(t.priceCheia),
      };
      if (t.pricePonta !== undefined) out.pricePonta = num(t.pricePonta);
      if (t.priceVazio !== undefined) out.priceVazio = num(t.priceVazio);
      if (t.priceSuperVazio !== undefined) out.priceSuperVazio = num(t.priceSuperVazio);
      if (!['simples', 'bi-horaria', 'tri-horaria'].includes(out.tariffType)) return null;
      if (out.contractedPower === undefined || out.powerPrice === undefined || out.priceCheia === undefined) return null;
      return out;
    };
    extractedData.priceTiers = (extractedData.priceTiers || []).map(sanitizeTier).filter(Boolean);
    extractedData.priceMatrix = (extractedData.priceMatrix || [])
      .map((cell: any) => {
        if (!cell || typeof cell !== 'object') return null;
        const tiers = Array.isArray(cell.tiers) ? cell.tiers.map(sanitizeTier).filter(Boolean) : [];
        return { ...cell, tiers };
      })
      .filter((c: any) => c && c.voltageLevel && c.quarterStart && c.contractEndDate && c.tiers.length > 0);

    // Validação de schema (tolerante: se falhar, mantém os dados sanitizados)
    const aiValidation = ExtractedPricesSchema.safeParse(extractedData);
    if (!aiValidation.success) {
      console.error(`[job ${jobId}] AI schema validation failed (continuing with sanitised data):`, aiValidation.error.flatten());
    } else {
      extractedData = aiValidation.data;
    }

    // Iberdrola: campanhas não suportam tri-horária — remover quaisquer tiers tri-horária
    // que a IA possa ter inventado/copiado, e sinalizar nas notas.
    if (isIberdrola && Array.isArray(extractedData?.priceTiers)) {
      const before = extractedData.priceTiers.length;
      extractedData.priceTiers = extractedData.priceTiers.filter(
        (t: any) => t?.tariffType !== 'tri-horaria'
      );
      if (Array.isArray(extractedData?.priceMatrix)) {
        extractedData.priceMatrix = extractedData.priceMatrix.map((cell: any) => ({
          ...cell,
          tiers: Array.isArray(cell?.tiers)
            ? cell.tiers.filter((t: any) => t?.tariffType !== 'tri-horaria')
            : [],
        })).filter((c: any) => (c.tiers?.length ?? 0) > 0);
      }
      if (before !== extractedData.priceTiers.length) {
        extractedData.notes = (extractedData.notes || '') +
          ' AVISO: Campanhas Iberdrola não disponibilizam tarifário Tri-horária; tiers tri-horária removidos.';
      }
    }

    if ((extractedData.priceTiers?.length ?? 0) === 0 && (extractedData.priceMatrix?.length ?? 0) === 0) {
      throw new Error("A IA não conseguiu extrair preços utilizáveis deste PDF. Verifique se o documento contém a tabela de preços esperada.");
    }

    if (isAxpo && extractedData?.priceTiers?.length > 0) {
      const simplesTiers = extractedData.priceTiers.filter((t: any) => t.tariffType === 'simples');
      const avgSimplePrice = simplesTiers.length > 0
        ? simplesTiers.reduce((sum: number, t: any) => sum + (t.priceCheia || 0), 0) / simplesTiers.length
        : 0;
      if (avgSimplePrice > 0 && avgSimplePrice < 0.14) {
        extractedData.notes = (extractedData.notes || '') + ' AVISO: Os preços extraídos podem ser S/ Tarifas (sem tarifas de acesso à rede). Verifique manualmente se o documento contém a secção "Tarifa DIA".';
      }
    }

    await supabaseAdmin.from('price_extraction_jobs')
      .update({ status: 'completed', result: extractedData, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    console.log(`[job ${jobId}] Completed`);
  } catch (error) {
    console.error(`[job ${jobId}] Failed:`, error);
    await supabaseAdmin.from('price_extraction_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

