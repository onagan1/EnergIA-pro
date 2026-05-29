import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppState, ClientData, ConsumptionProfile, Supplier, BrandingConfig } from '../types';

const defaultClientData: ClientData = {
  name: '',
  nif: '',
  cpe: '',
  contractStartDate: new Date().toISOString().split('T')[0],
  contractEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .split('T')[0],
  consultantName: '',
  consultantPhone: '',
  consultantEmail: '',
};

const defaultConsumptionProfile: ConsumptionProfile = {
  tensionLevel: 'BTN',
  contractedPower: '6.90',
  php: 0,
  tariffOption: 'Simples',
  cycleOption: 'Diário',
  consumptionVazio: 0,
  consumptionCheia: 0,
  consumptionPonta: 0,
  consumptionSuperVazio: 0,
};

const defaultBranding: BrandingConfig = {
  companyName: 'EnergIA Pro',
  slogan: 'As melhores tarifas de energia',
  logoUrl: '',
  primaryColor: '#0ea5e9',
  secondaryColor: '#38bdf8',
  accentColor: '#0284c7',
  termsAndConditions: 'Proposta válida por 15 dias. Os valores apresentados não incluem IVA, exceto quando indicado.',
};

const defaultSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'Atual (Média de Mercado)',
    isCurrent: true,
    priceEnergyPonta: 0.25,
    priceEnergyCheia: 0.20,
    priceEnergyVazio: 0.15,
    priceEnergySuperVazio: 0.12,
    pricePower: 0.50,
    pricePowerContratada: 0.30,
    pricePowerPHP: 0.20,
    includesTAR: true,
    includesFTS: false,
    includesCGS: false,
    includesmFRR: false,
    hasFidelization: false,
    fidelizationMonths: 0,
    marginK: 0,
  },
  {
    id: '2',
    name: 'Nova Energia',
    isCurrent: false,
    priceEnergyPonta: 0.18,
    priceEnergyCheia: 0.14,
    priceEnergyVazio: 0.11,
    priceEnergySuperVazio: 0.09,
    pricePower: 0.45,
    pricePowerContratada: 0.28,
    pricePowerPHP: 0.18,
    includesTAR: false,
    includesFTS: false,
    includesCGS: false,
    includesmFRR: false,
    hasFidelization: true,
    fidelizationMonths: 12,
    marginK: 5,
  }
];

const SIMS_KEY = 'energia_saved_sims';

export interface SavedSimulation {
  name: string;
  savedAt: string;
  state: AppState;
}

interface AppContextType {
  state: AppState;
  updateClientData: (data: Partial<ClientData>) => void;
  updateConsumptionProfile: (data: Partial<ConsumptionProfile>) => void;
  updateBranding: (data: Partial<BrandingConfig>) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;
  resetSimulation: () => void;
  saveSimulation: (name: string) => void;
  loadSimulation: (name: string) => void;
  deleteSimulation: (name: string) => void;
  listSimulations: () => SavedSimulation[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function defaultState(): AppState {
  return {
    clientData: defaultClientData,
    consumptionProfile: defaultConsumptionProfile,
    branding: defaultBranding,
    suppliers: defaultSuppliers,
  };
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('energia_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return defaultState();
  });

  const saveState = (newState: AppState) => {
    setState(newState);
    localStorage.setItem('energia_state', JSON.stringify(newState));
  };

  const updateClientData = (data: Partial<ClientData>) => {
    saveState({ ...state, clientData: { ...state.clientData, ...data } });
  };

  const updateConsumptionProfile = (data: Partial<ConsumptionProfile>) => {
    saveState({ ...state, consumptionProfile: { ...state.consumptionProfile, ...data } });
  };

  const updateBranding = (data: Partial<BrandingConfig>) => {
    saveState({ ...state, branding: { ...state.branding, ...data } });
  };

  const addSupplier = (supplier: Supplier) => {
    saveState({ ...state, suppliers: [...state.suppliers, supplier] });
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    saveState({
      ...state,
      suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const removeSupplier = (id: string) => {
    saveState({
      ...state,
      suppliers: state.suppliers.filter((s) => s.id !== id),
    });
  };

  const resetSimulation = () => {
    const fresh = defaultState();
    // keep current branding configuration
    saveState({ ...fresh, branding: state.branding });
  };

  const listSimulations = (): SavedSimulation[] => {
    try {
      return JSON.parse(localStorage.getItem(SIMS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const persistSims = (sims: SavedSimulation[]) =>
    localStorage.setItem(SIMS_KEY, JSON.stringify(sims));

  const saveSimulation = (name: string) => {
    const sims = listSimulations().filter((s) => s.name !== name);
    sims.unshift({ name, savedAt: new Date().toISOString(), state });
    persistSims(sims);
  };

  const loadSimulation = (name: string) => {
    const sim = listSimulations().find((s) => s.name === name);
    if (sim) saveState(sim.state);
  };

  const deleteSimulation = (name: string) => {
    persistSims(listSimulations().filter((s) => s.name !== name));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        updateClientData,
        updateConsumptionProfile,
        updateBranding,
        addSupplier,
        updateSupplier,
        removeSupplier,
        resetSimulation,
        saveSimulation,
        loadSimulation,
        deleteSimulation,
        listSimulations,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
