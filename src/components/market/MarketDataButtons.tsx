import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const extractedId = supabaseUrl.split('.')[0].split('//').pop();
const PROJECT_ID = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) || extractedId;

function functionUrl(name: string): string {
  return `https://${PROJECT_ID}.supabase.co/functions/v1/${name}`;
}

async function uploadToFunction(name: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token}` },
    body: formData,
  });
  return response.json();
}

interface UploadButtonProps {
  fnName: string;
  label: string;
  loadingLabel: string;
  accept: string;
  title: string;
  successTitle: string;
  errorTitle: string;
  onSuccess?: (data: any) => void;
}

function UploadButton({
  fnName,
  label,
  loadingLabel,
  accept,
  title,
  successTitle,
  errorTitle,
  onSuccess,
}: UploadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validExt = accept.split(',').map((e) => e.trim().replace('.', ''));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExt.includes(ext)) {
      toast({
        title: 'Ficheiro inválido',
        description: `Por favor selecione um ficheiro: ${accept}`,
        variant: 'destructive',
      });
      return;
    }

    if (!PROJECT_ID) {
      toast({
        title: errorTitle,
        description: 'VITE_SUPABASE_PROJECT_ID não está configurado no .env',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await uploadToFunction(fnName, file);
      if (data?.success) {
        toast({
          title: successTitle,
          description:
            data.message ||
            `Ficheiro "${file.name}" enviado com sucesso (${Math.round(file.size / 1024)} KB)`,
        });
        onSuccess?.(data);
      } else {
        toast({
          title: errorTitle,
          description: data?.error || data?.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: errorTitle,
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        title={title}
      >
        <Upload className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? loadingLabel : label}
      </Button>
    </>
  );
}

export const ERCUpdateButton = () => (
  <UploadButton
    fnName="update-erc-data"
    label="Atualizar ERC"
    loadingLabel="A enviar..."
    accept=".xlsx,.xls"
    title="Atualizar ficheiro ERC-ISP (descarregar de mercado.ren.pt e enviar aqui)"
    successTitle="ERC atualizado"
    errorTitle="Erro ao atualizar ERC"
  />
);

export const MFRRUpdateButton = () => (
  <UploadButton
    fnName="update-mfrr-data"
    label="Atualizar mFRR"
    loadingLabel="A enviar..."
    accept=".xlsx,.xls,.csv"
    title="Atualizar ficheiro mFRR (upload de Excel/CSV com dados mFRR)"
    successTitle="mFRR atualizado"
    errorTitle="Erro ao atualizar mFRR"
  />
);

export const MarketDataUpdateButton = () => (
  <UploadButton
    fnName="update-market-data"
    label="Atualizar ERC + mFRR"
    loadingLabel="A enviar..."
    accept=".xlsx,.xls,.csv"
    title="Atualizar ficheiro de mercado (ERC-ISP + mFRR) — upload único para ambos"
    successTitle="Dados de mercado atualizados"
    errorTitle="Erro ao atualizar dados de mercado"
  />
);

export const InclusionsUpdateButton = () => (
  <UploadButton
    fnName="import-supplier-inclusions"
    label="Atualizar Inclusões"
    loadingLabel="A importar..."
    accept=".xlsx,.xls"
    title="Importar matriz COM/SEM (CGS, FTS, mFRR, TAR, Perdas, Desvios) por comercializadora x campanha"
    successTitle="Inclusões atualizadas"
    errorTitle="Erro ao importar inclusões"
    onSuccess={() => window.dispatchEvent(new Event('inclusions-updated'))}
  />
);
