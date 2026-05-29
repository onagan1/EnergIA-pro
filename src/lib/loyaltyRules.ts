// Regras de fidelização e elegibilidade doméstica por comercializador
// Fonte: tabela fornecida pelo cliente (Maio 2026)

export type LoyaltyClientType = "domestico" | "empresa" | "condominios" | undefined;
export type LoyaltyPriceType = "fixo" | "indexado" | "misto" | undefined;

type Rule = {
  // null => não comercializa para este perfil
  defaultLoyalty: boolean | null;
  note?: string;
};

type SupplierRules = {
  domestico: { fixo: Rule; indexado: Rule };
  empresa: { fixo: Rule; indexado: Rule };
};

const NOT_AVAILABLE: Rule = {
  defaultLoyalty: null,
  note: "Não comercializa para cliente doméstico",
};

// Chaves normalizadas (lowercase, sem acentos, sem espaços)
const RULES: Record<string, SupplierRules> = {
  alfaenergia: {
    domestico: { fixo: { defaultLoyalty: false }, indexado: { defaultLoyalty: false } },
    empresa: {
      fixo: { defaultLoyalty: true, note: "Com ou sem fidelização (depende da campanha)" },
      indexado: { defaultLoyalty: false },
    },
  },
  audax: {
    domestico: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: false } },
    empresa: {
      fixo: { defaultLoyalty: true },
      indexado: { defaultLoyalty: true, note: "Possibilidade sem fidelização" },
    },
  },
  axpo: {
    domestico: { fixo: NOT_AVAILABLE, indexado: NOT_AVAILABLE },
    empresa: {
      fixo: { defaultLoyalty: true, note: "Possibilidade sem fidelização; >1 GWh: Sem fidelização" },
      indexado: { defaultLoyalty: true, note: "Possibilidade sem fidelização; >1 GWh: Sem fidelização" },
    },
  },
  ezuenergia: {
    domestico: { fixo: { defaultLoyalty: false }, indexado: { defaultLoyalty: false } },
    empresa: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: true } },
  },
  iberdrola: {
    domestico: { fixo: { defaultLoyalty: false }, indexado: { defaultLoyalty: false } },
    empresa: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: false } },
  },
  luzboa: {
    domestico: { fixo: NOT_AVAILABLE, indexado: { defaultLoyalty: false } },
    empresa: {
      fixo: { defaultLoyalty: true },
      indexado: { defaultLoyalty: false, note: "Produto Click: Com fidelização" },
    },
  },
  plenitude: {
    domestico: { fixo: { defaultLoyalty: false }, indexado: { defaultLoyalty: false } },
    empresa: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: false } },
  },
  portulogos: {
    domestico: { fixo: NOT_AVAILABLE, indexado: NOT_AVAILABLE },
    empresa: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: true } },
  },
  yesenergy: {
    domestico: { fixo: { defaultLoyalty: false }, indexado: { defaultLoyalty: false } },
    empresa: { fixo: { defaultLoyalty: true }, indexado: { defaultLoyalty: false } },
  },
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "");

export interface ResolvedLoyaltyRule {
  hasRule: boolean;
  allowed: boolean; // false => comercializador não faz este tipo de cliente
  defaultLoyalty: boolean;
  note?: string;
}

export function getLoyaltyRule(
  supplierName: string | undefined | null,
  priceType: LoyaltyPriceType,
  clientType: LoyaltyClientType,
): ResolvedLoyaltyRule {
  const empty: ResolvedLoyaltyRule = { hasRule: false, allowed: true, defaultLoyalty: false };
  if (!supplierName) return empty;
  const key = normalize(supplierName);
  const rules = RULES[key];
  if (!rules) return empty;

  // Condomínios trata-se como não doméstico (empresa)
  const bucket = clientType === "domestico" ? "domestico" : "empresa";
  // "misto" segue regra do "fixo"
  const pt = priceType === "indexado" ? "indexado" : "fixo";
  const rule = rules[bucket][pt];

  if (rule.defaultLoyalty === null) {
    return { hasRule: true, allowed: false, defaultLoyalty: false, note: rule.note };
  }
  return { hasRule: true, allowed: true, defaultLoyalty: rule.defaultLoyalty, note: rule.note };
}
