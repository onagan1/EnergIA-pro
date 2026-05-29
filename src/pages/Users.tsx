import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface UserRow {
  user_id: string;
  email: string;
  role: string;
}

export function Users() {
  const { toast } = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('profiles').select('id, email'),
      ]);
      const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
      setRows(
        (roles ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role,
          email: emailMap.get(r.user_id) || r.user_id,
        }))
      );
    } catch (err: any) {
      toast({ title: 'Erro ao carregar utilizadores', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (userId: string, role: string) => {
    const newRole = role === 'admin' ? 'user' : 'admin';
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Função atualizada', description: `Utilizador agora é ${newRole}.` });
      load();
    }
  };

  const removeRole = async (userId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1e293b] flex items-center gap-2">
          <UsersIcon className="h-7 w-7" /> Utilizadores
        </h1>
        <p className="text-slate-500 mt-1">Gira as funções (admin/utilizador) dos membros da equipa.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Funções de Utilizador</CardTitle>
          <CardDescription>Origem: tabelas user_roles e profiles do Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-slate-400">A carregar...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-slate-400">Sem utilizadores registados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {r.role === 'admin' ? (
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Shield className="h-4 w-4 text-slate-400" />
                        )}
                        {r.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => changeRole(r.user_id, r.role)}>
                        {r.role === 'admin' ? 'Tornar Utilizador' : 'Tornar Admin'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => removeRole(r.user_id)}>
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
