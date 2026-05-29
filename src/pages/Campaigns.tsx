import React, { useEffect, useState } from 'react';
import { UploadCloud, FileText, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const BUCKET = 'comercializadoras';

interface CampaignFile {
  name: string;
  size: string;
}

export function Campaigns() {
  const { toast } = useToast();
  const [files, setFiles] = useState<CampaignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list();
      if (error) throw error;
      setFiles(
        (data ?? [])
          .filter((f) => f.name !== '.emptyFolderPlaceholder')
          .map((f) => ({
            name: f.name,
            size: ((f.metadata?.size ?? 0) / 1024 / 1024).toFixed(2) + ' MB',
          }))
      );
    } catch (err: any) {
      toast({ title: 'Erro ao listar campanhas', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (file: File) => {
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(`${Date.now()}-${file.name}`, file);
      if (error) throw error;
      toast({ title: 'Campanha carregada', description: file.name });
      load();
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    }
  };

  const remove = async (name: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    Array.from(e.dataTransfer.files).forEach(upload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1e293b]">Upload de Campanhas</h1>
        <p className="text-slate-500 mt-1">
          Carregue PDFs de campanhas dos comercializadores para o bucket "{BUCKET}".
        </p>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] relative ${
          dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.xlsx,.xls"
          multiple
          onChange={(e) => Array.from(e.target.files ?? []).forEach(upload)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="bg-slate-100 p-4 rounded-full text-slate-500 mb-4">
          <UploadCloud className="h-10 w-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Arraste os ficheiros de campanha aqui</h3>
        <p className="text-slate-400 text-sm mt-1">Ou clique para selecionar (PDF, XLSX)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campanhas no Storage</CardTitle>
          <CardDescription>Ficheiros guardados no bucket "{BUCKET}".</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-slate-400">A carregar...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-10 text-slate-400 flex flex-col items-center">
              <FileText className="h-12 w-12 text-slate-300 mb-2" />
              <p>Nenhuma campanha carregada.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((f) => (
                <div key={f.name} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm truncate max-w-md">{f.name}</p>
                      <p className="text-slate-400 text-xs">{f.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> No Storage
                    </span>
                    <button
                      onClick={() => remove(f.name)}
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
  );
}
