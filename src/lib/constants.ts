// TAR (Tarifa de Acesso às Redes) - hypothetical 2024 values for simulation purposes
// Actual ERSE values vary by year, so we mock standard representative values

export const ERSE_RATES = {
  // €/kWh
  TAR_ENERGY: {
    BTN: {
      Simples: { Cheia: 0.055 },
      'Bi-horária': { Cheia: 0.065, Vazio: 0.035 },
      'Tri-horária': { Ponta: 0.085, Cheia: 0.055, Vazio: 0.035 },
      'Tetra-horária': { Ponta: 0.085, Cheia: 0.055, Vazio: 0.035, SuperVazio: 0.025 }
    },
    BTE: {
      'Tetra-horária': { Ponta: 0.045, Cheia: 0.035, Vazio: 0.020, SuperVazio: 0.015 }
    },
    MT: {
      'Tetra-horária': { Ponta: 0.035, Cheia: 0.025, Vazio: 0.015, SuperVazio: 0.010 }
    },
    AT: {
      'Tetra-horária': { Ponta: 0.025, Cheia: 0.015, Vazio: 0.010, SuperVazio: 0.005 }
    },
    MAT: {
      'Tetra-horária': { Ponta: 0.015, Cheia: 0.010, Vazio: 0.005, SuperVazio: 0.002 }
    }
  },
  
  // Power Rates
  TAR_POWER: {
    BTN: 0.15, // €/dia
    BTE: { PC: 0.50, PHP: 0.20 }, // €/kW.dia
    MT: { PC: 0.40, PHP: 0.15 },
    AT: { PC: 0.30, PHP: 0.10 },
    MAT: { PC: 0.20, PHP: 0.05 },
  }
};

export const FEES = {
  FTS: 0.0023, // Taxa Social FTS €/kWh
  CGS: 0.0015, // Custos Gestão Sistema €/kWh
  mFRR: 0.0008, // Reserva Restauração €/kWh
};

export const BTN_POWER_OPTIONS = [
  1.15, 2.30, 3.45, 4.60, 5.75, 6.90, 10.35, 13.80, 17.25, 20.70, 27.60, 34.50, 41.40
];
