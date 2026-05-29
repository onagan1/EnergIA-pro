import { AppState, Supplier, ConsumptionProfile } from '../types';
import { ERSE_RATES, FEES } from './constants';

export interface CalculationResult {
  supplierId: string;
  energyCost: number;
  powerCost: number;
  tarCost: number;
  ftsCost: number;
  cgsCost: number;
  mfrrCost: number;
  totalCost: number;
  monthlyCost: number;
  annualCost: number;
  commission: number;
  
  // Breakdowns
  pontaCost: number;
  cheiaCost: number;
  vazioCost: number;
  superVazioCost: number;
}

export function calculateCosts(state: AppState): CalculationResult[] {
  const { consumptionProfile, suppliers, clientData } = state;
  
  // Resolve period total days
  const start = new Date(clientData.contractStartDate);
  const end = new Date(clientData.contractEndDate);
  const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  
  const cPonta = Number(consumptionProfile.consumptionPonta) || 0;
  const cCheia = Number(consumptionProfile.consumptionCheia) || 0; // or simply total for Simples
  const cVazio = Number(consumptionProfile.consumptionVazio) || 0;
  const cSVazio = Number(consumptionProfile.consumptionSuperVazio) || 0;
  const totalConsumption = cPonta + cCheia + cVazio + cSVazio;
  
  const pc = Number(consumptionProfile.contractedPower) || 0;
  const php = Number(consumptionProfile.php) || 0;
  
  return suppliers.map((supplier) => {
    // Energy Costs
    let pontaCost = cPonta * supplier.priceEnergyPonta;
    let cheiaCost = cCheia * supplier.priceEnergyCheia;
    let vazioCost = cVazio * supplier.priceEnergyVazio;
    let superVazioCost = cSVazio * supplier.priceEnergySuperVazio;
    
    // If tariff is Simples, use Cheia for everything for ease if they mapped it that way
    if (consumptionProfile.tariffOption === 'Simples') {
      cheiaCost = cCheia * supplier.priceEnergyCheia;
      pontaCost = 0; vazioCost = 0; superVazioCost = 0;
    } else if (consumptionProfile.tariffOption === 'Bi-horária') {
      pontaCost = 0; superVazioCost = 0;
    } else if (consumptionProfile.tariffOption === 'Tri-horária') {
      superVazioCost = 0;
    }
    
    const energyCost = pontaCost + cheiaCost + vazioCost + superVazioCost;
    
    // Power Cost
    let powerCost = 0;
    if (consumptionProfile.tensionLevel === 'BTN') {
      powerCost = supplier.pricePower * periodDays;
    } else {
      powerCost = (pc * supplier.pricePowerContratada * periodDays) + (php * supplier.pricePowerPHP * periodDays);
    }
    
    // TAR (Tarifa Acesso Redes)
    let tarCost = 0;
    if (!supplier.includesTAR) {
      const tension = consumptionProfile.tensionLevel;
      if (tension === 'BTN') {
        const tariffOpt = consumptionProfile.tariffOption;
        // simplistic fallback to avoid deep nesting issues
        if (tariffOpt === 'Simples') {
           tarCost += cCheia * ERSE_RATES.TAR_ENERGY.BTN.Simples.Cheia;
        } else if (tariffOpt === 'Bi-horária') {
           tarCost += cCheia * ERSE_RATES.TAR_ENERGY.BTN['Bi-horária'].Cheia;
           tarCost += cVazio * ERSE_RATES.TAR_ENERGY.BTN['Bi-horária'].Vazio;
        } else if (tariffOpt === 'Tri-horária') {
           tarCost += cPonta * ERSE_RATES.TAR_ENERGY.BTN['Tri-horária'].Ponta;
           tarCost += cCheia * ERSE_RATES.TAR_ENERGY.BTN['Tri-horária'].Cheia;
           tarCost += cVazio * ERSE_RATES.TAR_ENERGY.BTN['Tri-horária'].Vazio;
        } else {
           tarCost += cPonta * ERSE_RATES.TAR_ENERGY.BTN['Tetra-horária'].Ponta;
           tarCost += cCheia * ERSE_RATES.TAR_ENERGY.BTN['Tetra-horária'].Cheia;
           tarCost += cVazio * ERSE_RATES.TAR_ENERGY.BTN['Tetra-horária'].Vazio;
           tarCost += cSVazio * ERSE_RATES.TAR_ENERGY.BTN['Tetra-horária'].SuperVazio;
        }
        tarCost += ERSE_RATES.TAR_POWER.BTN * periodDays;
      } else {
        // BTE/MT/AT/MAT
        const rates = (ERSE_RATES.TAR_ENERGY as any)[tension]?.['Tetra-horária'];
        if (rates) {
           tarCost += cPonta * rates.Ponta;
           tarCost += cCheia * rates.Cheia;
           tarCost += cVazio * rates.Vazio;
           tarCost += cSVazio * rates.SuperVazio;
        }
        const pRates = (ERSE_RATES.TAR_POWER as any)[tension];
        if (pRates) {
           tarCost += (pc * pRates.PC * periodDays) + (php * pRates.PHP * periodDays);
        }
      }
    }
    
    const ftsCost = supplier.includesFTS ? 0 : totalConsumption * FEES.FTS;
    const cgsCost = supplier.includesCGS ? 0 : totalConsumption * FEES.CGS;
    const mfrrCost = supplier.includesmFRR ? 0 : totalConsumption * FEES.mFRR;
    
    const totalCost = energyCost + powerCost + tarCost + ftsCost + cgsCost + mfrrCost;
    
    const monthlyCost = (totalCost / periodDays) * 30;
    const annualCost = (totalCost / periodDays) * 365;
    
    // Commission - simplified: Margin K
    // Comissao K = Margin K (€/MWh) * Consumo Anual Estimado (MWh) * (percent - 100% for simplicity)
    const annualConsumptionMwh = (totalConsumption / periodDays * 365) / 1000;
    const commission = supplier.marginK * annualConsumptionMwh;
    
    return {
      supplierId: supplier.id,
      energyCost,
      powerCost,
      tarCost,
      ftsCost,
      cgsCost,
      mfrrCost,
      totalCost,
      monthlyCost,
      annualCost,
      commission,
      
      pontaCost,
      cheiaCost,
      vazioCost,
      superVazioCost,
    };
  });
}
