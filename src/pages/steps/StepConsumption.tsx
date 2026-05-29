import React from 'react';
import { useAppContext } from '../../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BTN_POWER_OPTIONS } from '../../lib/constants';
import { TensionLevel, TariffOption, CycleOption } from '../../types';

export const StepConsumption = () => {
  const { state, updateConsumptionProfile } = useAppContext();
  const cp = state.consumptionProfile;

  const showBTNPower = cp.tensionLevel === 'BTN';
  const showManualPower = cp.tensionLevel !== 'BTN';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Perfil de Consumo</CardTitle>
          <CardDescription>Defina as características técnicas da instalação e os valores de consumo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nível de Tensão</Label>
              <Select
                value={cp.tensionLevel}
                onValueChange={(val: TensionLevel) => updateConsumptionProfile({ tensionLevel: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTN">Baixa Tensão Normal (BTN)</SelectItem>
                  <SelectItem value="BTE">Baixa Tensão Especial (BTE)</SelectItem>
                  <SelectItem value="MT">Média Tensão (MT)</SelectItem>
                  <SelectItem value="AT">Alta Tensão (AT)</SelectItem>
                  <SelectItem value="MAT">Muito Alta Tensão (MAT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opção Tarifária</Label>
              <Select
                value={cp.tariffOption}
                onValueChange={(val: TariffOption) => updateConsumptionProfile({ tariffOption: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Simples">Simples</SelectItem>
                  <SelectItem value="Bi-horária">Bi-horária</SelectItem>
                  <SelectItem value="Tri-horária">Tri-horária</SelectItem>
                  <SelectItem value="Tetra-horária">Tetra-horária</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showBTNPower ? (
              <div className="space-y-2">
                <Label>Potência Contratada (kVA)</Label>
                <Select
                  value={String(cp.contractedPower)}
                  onValueChange={(val) => updateConsumptionProfile({ contractedPower: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BTN_POWER_OPTIONS.map((kva) => (
                      <SelectItem key={kva} value={String(kva)}>{kva.toFixed(2)} kVA</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Potência Contratada (kW)</Label>
                  <Input
                    type="number"
                    value={cp.contractedPower}
                    onChange={(e) => updateConsumptionProfile({ contractedPower: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pot. Horas Ponta (PHP) (kW)</Label>
                  <Input
                    type="number"
                    value={cp.php}
                    onChange={(e) => updateConsumptionProfile({ php: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Ciclo Horário</Label>
              <Select
                value={cp.cycleOption}
                onValueChange={(val: CycleOption) => updateConsumptionProfile({ cycleOption: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diário">Diário</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Semanal Opcional">Semanal Opcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-medium mb-4 text-slate-800">Consumo Efetivo Registado (kWh)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {cp.tariffOption === 'Simples' && (
                <div className="space-y-2">
                  <Label>Consumo/Energia</Label>
                  <Input
                    type="number"
                    value={cp.consumptionCheia}
                    onChange={(e) => updateConsumptionProfile({ consumptionCheia: Number(e.target.value) })}
                  />
                </div>
              )}

              {(cp.tariffOption === 'Bi-horária' || cp.tariffOption === 'Tri-horária' || cp.tariffOption === 'Tetra-horária') && (
                <>
                  {['Tri-horária', 'Tetra-horária'].includes(cp.tariffOption) && (
                     <div className="space-y-2">
                      <Label>Ponta</Label>
                      <Input type="number" value={cp.consumptionPonta} onChange={(e) => updateConsumptionProfile({ consumptionPonta: Number(e.target.value) })} />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>{cp.tariffOption === 'Bi-horária' ? 'Cheia / Fora Vazio' : 'Cheia'}</Label>
                    <Input type="number" value={cp.consumptionCheia} onChange={(e) => updateConsumptionProfile({ consumptionCheia: Number(e.target.value) })} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Vazio</Label>
                    <Input type="number" value={cp.consumptionVazio} onChange={(e) => updateConsumptionProfile({ consumptionVazio: Number(e.target.value) })} />
                  </div>

                  {cp.tariffOption === 'Tetra-horária' && (
                     <div className="space-y-2">
                      <Label>Super Vazio</Label>
                      <Input type="number" value={cp.consumptionSuperVazio} onChange={(e) => updateConsumptionProfile({ consumptionSuperVazio: Number(e.target.value) })} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
