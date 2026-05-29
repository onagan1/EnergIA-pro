import React from 'react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import {
  ERCUpdateButton,
  MFRRUpdateButton,
  MarketDataUpdateButton,
  InclusionsUpdateButton,
} from '../components/market/MarketDataButtons';
import { DynamicsIntegration } from '../components/market/DynamicsIntegration';

export const AdminConfig = () => {
  const { state, updateBranding } = useAppContext();
  const { branding } = state;
  const { toast } = useToast();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e293b]">Customização White-Label</h1>
        <p className="text-slate-500 mt-1">Configure o simulador e o PDF gerado para a marca da sua empresa.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identificação da Empresa</CardTitle>
          <CardDescription>Nome e frase de destaque apresentados na interface e no PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={branding.companyName}
                onChange={(e) => updateBranding({ companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slogan</Label>
              <Input
                value={branding.slogan}
                onChange={(e) => updateBranding({ slogan: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Termos e Condições (Rodapé PDF)</Label>
              <Input
                value={branding.termsAndConditions}
                onChange={(e) => updateBranding({ termsAndConditions: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paleta de Cores</CardTitle>
          <CardDescription>Defina as cores em HEX (ex: #000000) para personalizar a aplicação e os PDFs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  className="w-10 h-10 p-1 bg-white border rounded cursor-pointer"
                  value={branding.primaryColor}
                  onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                />
                <Input
                  className="font-mono uppercase"
                  value={branding.primaryColor}
                  onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
               <div className="flex space-x-2">
                <input
                  type="color"
                  className="w-10 h-10 p-1 bg-white border rounded cursor-pointer"
                  value={branding.secondaryColor}
                  onChange={(e) => updateBranding({ secondaryColor: e.target.value })}
                />
                <Input
                  className="font-mono uppercase"
                  value={branding.secondaryColor}
                  onChange={(e) => updateBranding({ secondaryColor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
               <div className="flex space-x-2">
                <input
                  type="color"
                  className="w-10 h-10 p-1 bg-white border rounded cursor-pointer"
                  value={branding.accentColor}
                  onChange={(e) => updateBranding({ accentColor: e.target.value })}
                />
                <Input
                  className="font-mono uppercase"
                  value={branding.accentColor}
                  onChange={(e) => updateBranding({ accentColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados de Mercado (ERSE / REN)</CardTitle>
          <CardDescription>
            Carregue os ficheiros descarregados de mercado.ren.pt para atualizar os custos ERC-ISP, mFRR e a matriz de inclusões por comercializador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <MarketDataUpdateButton />
            <ERCUpdateButton />
            <MFRRUpdateButton />
            <InclusionsUpdateButton />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Requer <code>VITE_SUPABASE_PROJECT_ID</code> configurado no .env e as edge functions implantadas.
          </p>
        </CardContent>
      </Card>

      <DynamicsIntegration state={state} />

      <div className="flex justify-end pt-4">
        <Button
          className="w-full md:w-auto px-8"
          style={{ backgroundColor: branding.primaryColor }}
          onClick={() => toast({ title: 'Configurações guardadas', description: 'As alterações de branding foram aplicadas com sucesso.' })}
        >
          Guardar Configurações
        </Button>
      </div>

    </div>
  );
};
