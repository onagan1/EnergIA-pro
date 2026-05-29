import React from 'react';
import { useAppContext } from '../../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const StepClient = () => {
  const { state, updateClientData } = useAppContext();
  const { clientData } = state;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
          <CardDescription>Insira as informações do cliente e dados do contrato atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome / Empresa</Label>
              <Input
                id="name"
                value={clientData.name}
                onChange={(e) => updateClientData({ name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input
                id="nif"
                value={clientData.nif}
                onChange={(e) => updateClientData({ nif: e.target.value })}
                placeholder="Ex: 123456789"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cpe">CPE (Código Ponto de Entrega)</Label>
              <Input
                id="cpe"
                value={clientData.cpe}
                onChange={(e) => updateClientData({ cpe: e.target.value })}
                placeholder="Ex: PT0002000012345678YZ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Início de Faturação Analisada</Label>
              <Input
                id="start"
                type="date"
                value={clientData.contractStartDate}
                onChange={(e) => updateClientData({ contractStartDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Fim de Faturação Analisada</Label>
              <Input
                id="end"
                type="date"
                value={clientData.contractEndDate}
                onChange={(e) => updateClientData({ contractEndDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultor Comercial (Opcional)</CardTitle>
          <CardDescription>Estes dados serão utilizados na assinatura da proposta PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="consName">Nome do Consultor</Label>
              <Input
                id="consName"
                value={clientData.consultantName}
                onChange={(e) => updateClientData({ consultantName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consPhone">Telefone</Label>
              <Input
                id="consPhone"
                value={clientData.consultantPhone}
                onChange={(e) => updateClientData({ consultantPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="consEmail">Email</Label>
              <Input
                id="consEmail"
                type="email"
                value={clientData.consultantEmail}
                onChange={(e) => updateClientData({ consultantEmail: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
