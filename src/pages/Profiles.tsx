import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface CommissionProfile {
  id: string;
  name: string;
  description?: string | null;
}

export function Profiles() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<CommissionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('commission_profiles').select('*').order('name');
      if (error) throw error;
      setProfiles((data ?? []) as CommissionProfile[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar perfis', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('commission_profiles').insert({ name, description });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil criado', description: name });
      setName('');
      setDescription('');
      load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('commission_profiles').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1e293b] flex items-center gap-2">
          <Percent className="h-7 w-7" /> Perfis &amp; Comissões
        </h1>
        <p className="text-slate-500 mt-1">Defina perfis de comissionamento e atribua-os a utilizadores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Perfil de Comissão</CardTitle>
          <CardDescription>Cria um perfil na tabela commission_profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Padrão" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
            <Button onClick={create} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfis Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-slate-400">A carregar...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-10 text-slate-400">Sem perfis criados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-slate-500">{p.description || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
