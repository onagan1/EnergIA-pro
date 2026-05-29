// Validação Zod partilhada entre Edge Functions.
// Importa Zod via esm.sh para Deno.
import { z } from "https://esm.sh/zod@3.23.8";

export { z };

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function flattenZodError(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: jsonResponse({ error: "JSON inválido no body" }, 400),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "Dados inválidos", fields: flattenZodError(parsed.error) },
        400,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

// ===== Schemas partilhados =====

const nonNeg = z.number().finite().min(0, "Não pode ser negativo");

export const PowerAutomateUrlSchema = z
  .string()
  .url("URL inválido")
  .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
  .refine(
    (u) =>
      /^https:\/\/prod-\d+\.[a-z]+\.logic\.azure\.com\/.*/i.test(u) ||
      /^https:\/\/prod\d+-[a-z]+\.logic\.azure\.com\/.*/i.test(u),
    "Use apenas URLs Power Automate (*.logic.azure.com)",
  );

export const DynamicsPayloadSchema = z.object({
  webhookUrl: PowerAutomateUrlSchema,
  cliente: z.object({
    nome: z.string().trim().min(1, "Nome do cliente obrigatório"),
    nif: z.string().regex(/^\d{9}$/, "NIF deve ter 9 dígitos"),
    cpe: z.string().trim().min(1, "CPE obrigatório"),
    dataInicioContrato: z.string().optional(),
  }),
  comercial: z.object({
    nome: z.string().trim().min(1, "Nome do comercial obrigatório"),
    telefone: z.string().trim().min(1, "Telefone obrigatório"),
    email: z.string().email("Email inválido"),
  }),
  consumo: z.object({
    nivelTensao: z.string(),
    tarifa: z.string(),
    ciclo: z.string(),
    potenciaContratada: z.string(),
    dias: z.number().int().positive("Dias deve ser > 0"),
    ponta: nonNeg,
    cheia: nonNeg,
    vazio: nonNeg,
    superVazio: nonNeg,
    consumoTotal: nonNeg,
  }),
  resultados: z.object({
    fornecedorMaisBarato: z.string().min(1),
    custoMensalMaisBarato: nonNeg,
    custoAnualMaisBarato: nonNeg,
    poupancaVsAtual: z.number().optional(),
    fornecedorAtual: z.string().optional(),
  }),
  fornecedores: z
    .array(
      z.object({
        nome: z.string().min(1),
        custoMensal: nonNeg,
        custoAnual: nonNeg,
        fidelizacao: z.boolean(),
        vigencia: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1, "Pelo menos 1 comercializador é obrigatório"),
  metadata: z.object({
    dataProposta: z.string().min(1),
    origem: z.string().min(1),
  }),
});

// AI extraction (preços completos)
const PriceTierSchema = z.object({
  tariffType: z.enum(["simples", "bi-horaria", "tri-horaria"]),
  contractedPower: nonNeg,
  powerPrice: nonNeg,
  pricePonta: nonNeg.optional(),
  priceCheia: nonNeg,
  priceVazio: nonNeg.optional(),
  priceSuperVazio: nonNeg.optional(),
});

export const ExtractedPricesSchema = z.object({
  name: z.string().optional().default(""),
  campaignName: z.string().optional().default(""),
  hasLoyalty: z.boolean().optional().default(false),
  contractDuration: z.number().optional(),
  priceTiers: z.array(PriceTierSchema).default([]),
  priceMatrix: z
    .array(
      z.object({
        voltageLevel: z.enum(["BTN", "BTE", "MT", "AT", "MAT"]),
        cycleType: z.enum(["simples", "diario", "semanal", "semanal_opcional"]).optional(),
        quarterStart: z.string(),
        contractEndDate: z.string(),
        tiers: z.array(PriceTierSchema),
      }),
    )
    .default([]),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
  notes: z.string().optional(),
});

// AI extraction (preços simples - extract-supplier-prices)
export const SupplierPricesAISchema = z.object({
  name: z.string(),
  pricePonta: nonNeg,
  priceCheia: nonNeg,
  priceVazio: nonNeg,
  priceSuperVazio: nonNeg,
  powerPrice: nonNeg,
  hasLoyalty: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().optional(),
});

// AI extraction (comissões)
export const CommissionsExtractionSchema = z.object({
  entries: z.array(
    z.object({
      supplier_name: z.string().min(1),
      campaign_name: z.string().optional(),
      criteria_type: z
        .enum(["potencia", "consumo_anual", "fixo", "personalizado"])
        .optional(),
      criteria_value: z.string().optional(),
      commission_value: z.number().finite(),
      commission_unit: z.enum(["euro", "euro_mwh", "percentagem"]),
      payment_mode: z.enum(["one_shot", "duodecimos"]).optional(),
      notes: z.string().optional(),
    }),
  ),
});

// Path safe (sem traversal) para list-supplier-pdfs
export const SafePathSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9 _.\-/]+$/, "Caracteres inválidos no caminho")
  .refine((p) => !p.includes(".."), "Path traversal não permitido")
  .refine((p) => !p.startsWith("/"), "Caminho não pode começar com /");
