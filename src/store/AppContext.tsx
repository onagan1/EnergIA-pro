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
    includesTAR: false, // Will add TAR
    includesFTS: false,
    includesCGS: false,
    includesmFRR: false,
    hasFidelization: true,
    fidelizationMonths: 12,
    marginK: 5,
  }
];

interface AppContextType {
  state: AppState;
  updateClientData: (data: Partial<ClientData>) => void;
  updateConsumptionProfile: (data: Partial<ConsumptionProfile>) => void;
  updateBranding: (data: Partial<BrandingConfig>) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(() => {
    // Try load from local storage
    const saved = localStorage.getItem('energia_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return {
      clientData: defaultClientData,
      consumptionProfile: defaultConsumptionProfile,
      branding: defaultBranding,
      suppliers: defaultSuppliers,
    };
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
