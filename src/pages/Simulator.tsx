import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StepClient } from './steps/StepClient';
import { StepConsumption } from './steps/StepConsumption';
import { StepResults } from './steps/StepResults';

export const Simulator = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e293b]">Nova Simulação</h1>
        <p className="text-slate-500 mt-1">Preencha os dados do cliente e faturas para iniciar.</p>
      </div>

      <Tabs defaultValue="client" className="space-y-6">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="client">1. Dados do Cliente</TabsTrigger>
          <TabsTrigger value="consumption">2. Perfil de Consumo</TabsTrigger>
          <TabsTrigger value="results">3. Resultados e Proposta</TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="focus-visible:outline-none">
          <StepClient />
        </TabsContent>

        <TabsContent value="consumption" className="focus-visible:outline-none">
          <StepConsumption />
        </TabsContent>

        <TabsContent value="results" className="focus-visible:outline-none">
          <StepResults />
        </TabsContent>
      </Tabs>
    </div>
  );
};
