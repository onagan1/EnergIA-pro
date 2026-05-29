// Tarifas de Acesso às Redes reguladas pela ERSE
// Fonte: ERSE - Tarifas 2026 (Diretiva ERSE n.º 10/2025)
// Ficheiro: s_tarifas_net.xlsx (15/dezembro/2025)
// Valores de Potência em EUR/(kW.dia)
// Valores de Energia em EUR/kWh

export interface NetworkTariff {
  peakPowerPrice: number; // Potência em Horas de Ponta - EUR/(kW.dia)
  contractedPowerPrice: number; // Potência Contratada - EUR/(kW.dia)
  // Tarifas de Energia por período - EUR/kWh
  energyPonta: number;
  energyCheia: number;
  energyVazio: number;
  energySuperVazio: number;
}

// Valores extraídos do ficheiro s_tarifas_net.xlsx - ERSE 2026
// TARIFA DE ACESSO ÀS REDES (MAT, AT, MT, BTE e BTN) - Portugal Continental
// Vigentes a partir de 01 de janeiro de 2026
export const NETWORK_TARIFFS: Record<string, NetworkTariff> = {
  BTN: {
    peakPowerPrice: 0, // BTN não tem potência em horas de ponta
    contractedPowerPrice: 0, // BTN usa valores fixos por escalão, não unitários
    // BTN não usa tarifas de acesso às redes por período
    energyPonta: 0,
    energyCheia: 0,
    energyVazio: 0,
    energySuperVazio: 0,
  },
  BTE: {
    // Fonte: TARIFA DE ACESSO ÀS REDES EM BTE - ERSE 2026
    peakPowerPrice: 0.5521, // Potência Horas de ponta - EUR/(kW.dia)
    contractedPowerPrice: 0.0563, // Potência Contratada - EUR/(kW.dia)
    // Tarifas de energia BTE
    energyPonta: 0.0397,
    energyCheia: 0.0353,
    energyVazio: 0.0285,
    energySuperVazio: 0.0237,
  },
  MT: {
    // Fonte: TARIFA DE ACESSO ÀS REDES EM MT - ERSE 2026
    peakPowerPrice: 0.2435, // Potência Horas de ponta - EUR/(kW.dia)
    contractedPowerPrice: 0.0458, // Potência Contratada - EUR/(kW.dia)
    // Tarifas de energia MT
    energyPonta: 0.0203,
    energyCheia: 0.0182,
    energyVazio: 0.0146,
    energySuperVazio: 0.0129,
  },
  AT: {
    // Fonte: TARIFA DE ACESSO ÀS REDES EM AT - ERSE 2026
    peakPowerPrice: 0.1515, // Potência Horas de ponta - EUR/(kW.dia)
    contractedPowerPrice: 0.0089, // Potência Contratada - EUR/(kW.dia)
    // Tarifas de energia AT
    energyPonta: 0.0125,
    energyCheia: 0.0115,
    energyVazio: 0.0102,
    energySuperVazio: 0.0094,
  },
  MAT: {
    // Fonte: TARIFA DE ACESSO ÀS REDES EM MAT - ERSE 2026
    peakPowerPrice: 0.0716, // Potência Horas de ponta - EUR/(kW.dia)
    contractedPowerPrice: 0.0126, // Potência Contratada - EUR/(kW.dia)
    // Tarifas de energia MAT
    energyPonta: 0.0073,
    energyCheia: 0.0069,
    energyVazio: 0.0067,
    energySuperVazio: 0.0063,
  },
};

export const getNetworkTariff = (voltageLevel: string): NetworkTariff | null => {
  return NETWORK_TARIFFS[voltageLevel] || null;
};

// TAR BTN por período - ERSE 2026 (€/kWh)
// Fonte: EDP - Tarifa de Acesso às Redes Eletricidade 2026
// Tri-horária divide-se por escalão de potência (≤20,7 kVA vs >20,7 kVA)
export interface BtnTarRates {
  ponta: number;
  cheia: number;
  vazio: number;
  superVazio: number;
}

export const getBtnTarPerPeriod = (
  tariffType: 'simples' | 'bi-horaria' | 'tri-horaria',
  contractedPowerKVA: number
): BtnTarRates => {
  if (tariffType === 'simples') {
    return { ponta: 0.0607, cheia: 0.0607, vazio: 0.0607, superVazio: 0.0607 };
  }
  if (tariffType === 'bi-horaria') {
    // ponta/cheia partilham o preço Fora de Vazio
    return { ponta: 0.0835, cheia: 0.0835, vazio: 0.0158, superVazio: 0.0158 };
  }
  // tri-horária: depende do escalão de potência
  const isHighPower = contractedPowerKVA > 20.7;
  return isHighPower
    ? { ponta: 0.2457, cheia: 0.0524, vazio: 0.0150, superVazio: 0.0150 }
    : { ponta: 0.2452, cheia: 0.0412, vazio: 0.0158, superVazio: 0.0158 };
};
