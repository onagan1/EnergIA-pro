import { useEffect, useState } from 'react';
import { Send, Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { calculateCosts } from '@/lib/engine';
import { AppState } from '@/types';

const WEBHOOK_STORAGE_KEY = 'dynamics_webhook_url';

const ALLOWED_WEBHOOK_PATTERNS = [
  /^https:\/\/prod-\d+\.[a-z]+\.logic\.azure\.com\/.*/i,
  /^https:\/\/prod\d+-[a-z]+\.logic\.azure\.com\/.*/i,
];

function isValidWebhookUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_WEBHOOK_PATTERNS.some((p) => p.test(url));
  } catch {
    return false;
  }
}

interface DynamicsIntegrationProps {
  state: AppState;
}

export function DynamicsIntegration({ state }: DynamicsIntegrationProps) {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(WEBHOOK_STORAGE_KEY);
    if (saved && isValidWebhookUrl(saved)) setWebhookUrl(saved);
  }, []);

  const handleWebhookChange = (url: string) => {
    setWebhookUrl(url);
    if (url.trim() && !isValidWebhookUrl(url)) {
      setWebhookError('Use apenas URLs Power Automate oficiais (*.logic.azure.com)');
      return;
    }
    setWebhookError(null);
    if (url) localStorage.setItem(WEBHOOK_STORAGE_KEY, url);
  };

  const handleSend = async () => {
    if (webhookUrl.trim() && !isValidWebhookUrl(webhookUrl)) {
      toast({
        title: 'URL do Webhook inválido',
        description: 'Use apenas URLs Power Automate oficiais (*.logic.azure.com)',
        variant: 'destructive',
      });
      return;
    }
    const missing: string[] = [];
    if (!webhookUrl.trim()) missing.push('URL do Webhook');
    if (state.suppliers.length === 0) missing.push('Pelo menos 1 comercializador');
    if (missing.length) {
      toast({
        title: 'Campos obrigatórios em falta',
        description: `Preencha: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const results = calculateCosts(state);
      const supplierCosts = results.map((r) => {
        const s = state.suppliers.find((x) => x.id === r.supplierId)!;
        return {
          nome: s.name,
          custoMensal: Math.round(r.monthlyCost * 100) / 100,
          custoAnual: Math.round(r.annualCost * 100) / 100,
          fidelizacao: s.hasFidelization,
          vigencia: s.fidelizationMonths || undefined,
        };
      });
      const cheapest = supplierCosts.reduce((prev, curr) =>
        curr.custoMensal < prev.custoMensal ? curr : prev
      );
      const current = state.suppliers.find((s) => s.isCurrent) || null;
      const currentCost = current ? supplierCosts.find((s) => s.nome === current.name) : null;

      const cp = state.consumptionProfile;
      const ponta = Number(cp.consumptionPonta) || 0;
      const cheia = Number(cp.consumptionCheia) || 0;
      const vazio = Number(cp.consumptionVazio) || 0;
      const superVazio = Number(cp.consumptionSuperVazio) || 0;

      const payload = {
        webhookUrl,
        cliente: {
          nome: state.clientData.name,
          nif: state.clientData.nif,
          cpe: state.clientData.cpe,
          dataInicioContrato: state.clientData.contractStartDate,
        },
        comercial: {
          nome: state.clientData.consultantName,
          telefone: state.clientData.consultantPhone,
          email: state.clientData.consultantEmail,
        },
        consumo: {
          nivelTensao: cp.tensionLevel,
          tarifa: cp.tariffOption,
          ciclo: cp.cycleOption,
          potenciaContratada: cp.contractedPower,
          ponta,
          cheia,
          vazio,
          superVazio,
          consumoTotal: ponta + cheia + vazio + superVazio,
        },
        resultados: {
          fornecedorMaisBarato: cheapest.nome,
          custoMensalMaisBarato: cheapest.custoMensal,
          custoAnualMaisBarato: cheapest.custoAnual,
          poupancaVsAtual: currentCost
            ? Math.round((currentCost.custoAnual - cheapest.custoAnual) * 100) / 100
            : undefined,
          fornecedorAtual: current?.name,
        },
        fornecedores: supplierCosts,
        metadata: {
          dataProposta: new Date().toISOString().split('T')[0],
          origem: 'EnergIA',
        },
      };

      const { error } = await supabase.functions.invoke('send-to-dynamics', { body: payload });
      if (error) throw error;

      setLastSentAt(new Date().toLocaleString('pt-PT'));
      toast({
        title: 'Enviado com sucesso',
        description: 'A proposta foi enviada para o Dynamics 365.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Não foi possível enviar a proposta.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-blue-600" />
          Integração Dynamics 365
        </CardTitle>
        <CardDescription>
          Envie a proposta para o Power Automate criar uma oportunidade no Dynamics 365
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL do Webhook Power Automate</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://prod-xx.westeurope.logic.azure.com/..."
            value={webhookUrl}
            onChange={(e) => handleWebhookChange(e.target.value)}
            className={webhookError ? 'border-red-400' : ''}
          />
          {webhookError ? (
            <p className="text-xs text-red-600">{webhookError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Cole aqui a URL do trigger HTTP do seu fluxo Power Automate
            </p>
          )}
        </div>

        <Button onClick={handleSend} disabled={isLoading || state.suppliers.length === 0} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              A enviar...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar para Dynamics 365
            </>
          )}
        </Button>

        {lastSentAt && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Último envio: {lastSentAt}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
