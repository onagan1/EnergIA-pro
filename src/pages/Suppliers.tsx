import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Supplier } from '../types';

export const Suppliers = () => {
  const { state, addSupplier, updateSupplier, removeSupplier } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  
  const defaultNew: Supplier = {
    id: Date.now().toString(),
    name: 'Novo Comercializador',
    isCurrent: false,
    priceEnergyPonta: 0.15,
    priceEnergyCheia: 0.12,
    priceEnergyVazio: 0.08,
    priceEnergySuperVazio: 0.06,
    pricePower: 0.40,
    pricePowerContratada: 0.30,
    pricePowerPHP: 0.20,
    includesTAR: false,
    includesFTS: false,
    includesCGS: false,
    includesmFRR: false,
    hasFidelization: false,
    fidelizationMonths: 0,
    marginK: 0
  };

  const [form, setForm] = useState<Supplier>(defaultNew);

  const handleSave = () => {
    addSupplier({ ...form, id: Date.now().toString() });
    setIsOpen(false);
    setForm(defaultNew);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1e293b]">Comercializadores</h1>
          <p className="text-slate-500 mt-1">Gira as opções de comercializadores e as regras de comissionamento.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button className="bg-slate-900" />}>
            Adicionar Comercializador
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Comercializador</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome do Comercializador</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 text-sm text-slate-800">Preços de Energia (€/kWh)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Ponta</Label>
                    <Input type="number" step="0.001" value={form.priceEnergyPonta} onChange={e => setForm({...form, priceEnergyPonta: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cheia (Base)</Label>
                    <Input type="number" step="0.001" value={form.priceEnergyCheia} onChange={e => setForm({...form, priceEnergyCheia: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vazio</Label>
                    <Input type="number" step="0.001" value={form.priceEnergyVazio} onChange={e => setForm({...form, priceEnergyVazio: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Super Vazio</Label>
                    <Input type="number" step="0.001" value={form.priceEnergySuperVazio} onChange={e => setForm({...form, priceEnergySuperVazio: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              
               <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 text-sm text-slate-800">Termo de Potência</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>BTN (€/dia)</Label>
                    <Input type="number" step="0.01" value={form.pricePower} onChange={e => setForm({...form, pricePower: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>PC MT/AT (€/kW.dia)</Label>
                    <Input type="number" step="0.01" value={form.pricePowerContratada} onChange={e => setForm({...form, pricePowerContratada: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>PHP MT/AT (€/kW.dia)</Label>
                    <Input type="number" step="0.01" value={form.pricePowerPHP} onChange={e => setForm({...form, pricePowerPHP: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

               <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 text-sm text-slate-800">Inclusões Toggles</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch checked={form.includesTAR} onCheckedChange={(c) => setForm({...form, includesTAR: c})} />
                    <Label>Inclui TAR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={form.includesFTS} onCheckedChange={(c) => setForm({...form, includesFTS: c})} />
                    <Label>Inclui FTS (Social)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={form.includesCGS} onCheckedChange={(c) => setForm({...form, includesCGS: c})} />
                    <Label>Inclui CGS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={form.includesmFRR} onCheckedChange={(c) => setForm({...form, includesmFRR: c})} />
                    <Label>Inclui mFRR</Label>
                  </div>
                </div>
              </div>

               <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 text-sm text-slate-800">Configurações de Margem</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Margem K (€ / MWh)</Label>
                    <Input type="number" value={form.marginK} onChange={e => setForm({...form, marginK: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave}>Salvar Comercializador</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
         <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comercializador</TableHead>
                <TableHead>Energia (Cheia)</TableHead>
                <TableHead>Potência BTN</TableHead>
                <TableHead>Margem K</TableHead>
                <TableHead>TAR</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name} {s.isCurrent && <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">Atual</span>}</TableCell>
                  <TableCell>{s.priceEnergyCheia.toFixed(3)}</TableCell>
                  <TableCell>{s.pricePower.toFixed(2)}</TableCell>
                  <TableCell>{s.marginK}</TableCell>
                  <TableCell>{s.includesTAR ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" className="text-red-600" onClick={() => removeSupplier(s.id)}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </Card>
      
    </div>
  );
};
