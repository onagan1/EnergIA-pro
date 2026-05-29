export type TensionLevel = 'BTN' | 'BTE' | 'MT' | 'AT' | 'MAT';
export type TariffOption = 'Simples' | 'Bi-horária' | 'Tri-horária' | 'Tetra-horária';
export type CycleOption = 'Diário' | 'Semanal' | 'Semanal Opcional';

export interface ClientData {
  name: string;
  nif: string;
  cpe: string;
  contractStartDate: string;
  contractEndDate: string;
  consultantName: string;
  consultantPhone: string;
  consultantEmail: string;
}

export interface ConsumptionProfile {
  tensionLevel: TensionLevel;
  contractedPower: number | string; // kVA for BTN, kW for others
  php: number | string; // kW
  tariffOption: TariffOption;
  cycleOption: CycleOption;
  consumptionVazio: number;
  consumptionCheia: number; // Also used for 'Simples'
  consumptionPonta: number;
  consumptionSuperVazio: number;
}

export interface Supplier {
  id: string;
  name: string;
  isCurrent: boolean;
  priceEnergyPonta: number;
  priceEnergyCheia: number;
  priceEnergyVazio: number;
  priceEnergySuperVazio: number;
  pricePower: number; // BTN (€/dia)
  pricePowerContratada: number; // BTE/MT etc (€/kW.dia)
  pricePowerPHP: number; // BTE/MT etc (€/kW.dia)
  includesTAR: boolean;
  includesFTS: boolean;
  includesCGS: boolean;
  includesmFRR: boolean;
  hasFidelization: boolean;
  fidelizationMonths: number;
  marginK: number; // €/MWh
}

export interface BrandingConfig {
  companyName: string;
  slogan: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  termsAndConditions: string;
}

export interface AppState {
  clientData: ClientData;
  consumptionProfile: ConsumptionProfile;
  suppliers: Supplier[];
  branding: BrandingConfig;
}
