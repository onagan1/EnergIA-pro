import React, { useState } from 'react';
import { FileText, UploadCloud, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

interface ImportedInvoice {
  id: string;
  name: string;
  size: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData?: {
    cpe: string;
    clientName: string;
    tensionLevel: string;
    contractedPower: string;
    totalConsumption: string;
  };
}

export function ImportPDFs() {
  const [dragActive, setDragActive] = useState(false);
  const [invoices, setInvoices] = useState<ImportedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<ImportedInvoice | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const newInvoice: ImportedInvoice = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      status: 'pending',
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Simulate IA parsing process
    setTimeout(() => {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === newInvoice.id ? { ...inv, status: 'processing' } : inv
        )
      );

      setTimeout(() => {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === newInvoice.id
              ? {
                  ...inv,
                  status: 'completed',
                  extractedData: {
                    cpe: 'PT0002000123456789XX',
                    clientName: 'Cliente Demo Lda',
                    tensionLevel: 'BTN',
                    contractedPower: '10.35 kVA',
                    totalConsumption: '1,450 kWh',
                  },
                }
              : inv
          )
        );
      }, 2000);
    }, 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        processFile(file);
      } else {
        alert("Apenas arquivos PDF são suportados!");
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const removeInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Importar PDFs</h1>
        <p className="text-slate-500 text-sm mt-1">
          Envie faturas de energia para extração automática de dados de consumo por inteligência artificial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[250px] relative ${
              dragActive
                ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                : "border-slate-300 hover:border-slate-400 bg-white"
            }`}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="bg-slate-100 p-4 rounded-full text-slate-500 mb-4">
              <UploadCloud className="h-10 w-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Arraste a fatura em PDF aqui</h3>
            <p className="text-slate-400 text-sm mt-1 mb-4">Ou clique para navegar no seu computador</p>
            <div className="text-xs text-slate-400">Tamanho máximo de arquivo: 10MB (Apenas .pdf)</div>
          </div>

          {/* Invoices List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Faturas Processadas</CardTitle>
              <CardDescription>Visualize o progresso e clique em uma fatura para ver os dados extraídos.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center justify-center">
                  <FileText className="h-12 w-12 text-slate-300 mb-2" />
                  <p>Nenhuma fatura carregada ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => inv.status === 'completed' && setSelectedInvoice(inv)}
                      className={`py-4 flex items-center justify-between cursor-pointer rounded-lg px-3 -mx-3 transition-colors ${
                        inv.status === 'completed' ? 'hover:bg-slate-50' : 'cursor-default'
                      } ${selectedInvoice?.id === inv.id ? 'bg-slate-50 border border-slate-200' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2.5 rounded-lg text-slate-500">
                          <FileText className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 text-sm max-w-xs truncate">{inv.name}</p>
                          <p className="text-slate-400 text-xs">{inv.size}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {inv.status === 'pending' && (
                          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full animate-pulse">
                            Pendente
                          </span>
                        )}
                        {inv.status === 'processing' && (
                          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full animate-pulse">
                            Analisando com IA...
                          </span>
                        )}
                        {inv.status === 'completed' && (
                          <span className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Extraído
                          </span>
                        )}
                        {inv.status === 'failed' && (
                          <span className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" /> Falhou
                          </span>
                        )}

                        <button
                          onClick={(e) => removeInvoice(inv.id, e)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-slate-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Extracted Data Sidebar View */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">Dados Extraídos por IA</CardTitle>
              <CardDescription>Resultado do processamento da fatura.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {selectedInvoice?.extractedData ? (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Cliente</span>
                    <p className="font-semibold text-slate-800 text-sm">{selectedInvoice.extractedData.clientName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CPE (Código Ponto Entrega)</span>
                    <p className="font-mono text-slate-800 text-sm font-semibold">{selectedInvoice.extractedData.cpe}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nível de Tensão</span>
                      <p className="font-semibold text-slate-800 text-sm">{selectedInvoice.extractedData.tensionLevel}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Potência Contratada</span>
                      <p className="font-semibold text-slate-800 text-sm">{selectedInvoice.extractedData.contractedPower}</p>
                    </div>
                  </div>
                  <div className="space-y-1 pb-4 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumo Total Período</span>
                    <p className="text-lg font-bold text-blue-600">{selectedInvoice.extractedData.totalConsumption}</p>
                  </div>

                  <Button className="w-full h-11 flex items-center justify-center gap-2">
                    Usar na Simulação <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center justify-center">
                  <FileText className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm">Selecione uma fatura concluída para visualizar os dados extraídos.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
