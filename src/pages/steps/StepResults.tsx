import React from 'react';
import { useAppContext } from '../../store/AppContext';
import { calculateCosts } from '../../lib/engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '../../components/ui/button';
import { FileText } from 'lucide-react';

export const StepResults = () => {
  const { state } = useAppContext();
  
  // Calculate results for all suppliers
  const results = calculateCosts(state);
  
  // Sort from cheapest to most expensive by total cost
  const sorted = [...results].sort((a, b) => a.totalCost - b.totalCost);
  
  const formatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-full">
        Nenhum resultado disponível. Por favor, adicione fornecedores e dados de consumo.
      </div>
    );
  }

  const bestResult = sorted[0];

  const generatePDF = () => {
     const doc = new jsPDF();
     const brand = state.branding;
     const client = state.clientData;
     
     // Page 1: Cover
     doc.setFontSize(24);
     doc.setTextColor(brand.primaryColor);
     doc.text(brand.companyName.toUpperCase(), 105, 40, { align: 'center' });
     
     doc.setFontSize(14);
     doc.setTextColor(100, 100, 100);
     doc.text(brand.slogan, 105, 50, { align: 'center' });
     
     doc.setFontSize(28);
     doc.setTextColor(0, 0, 0);
     doc.text('PROPOSTA COMERCIAL', 105, 100, { align: 'center' });
     
     // Client Table
     const clientData = [
       ['Cliente:', client.name],
       ['NIF:', client.nif],
       ['CPE:', client.cpe],
       ['Data da Proposta:', new Date().toLocaleDateString('pt-PT')],
     ];
     
     autoTable(doc, {
       startY: 130,
       body: clientData,
       theme: 'plain',
       styles: { fontSize: 12, cellPadding: 3 },
       columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
       margin: { left: 50 },
     });
     
     // Decorative bar
     doc.setFillColor(brand.primaryColor);
     doc.rect(0, 280, 210, 20, 'F');
     
     // Page 2: Comparison
     doc.addPage();
     
     doc.setFillColor(brand.secondaryColor);
     doc.rect(0, 0, 210, 30, 'F');
     doc.setTextColor(255, 255, 255);
     doc.setFontSize(16);
     doc.text('Comparativo de Custos', 15, 20);
     
     const tableData = sorted.map((res, i) => {
       const supplier = state.suppliers.find(s => s.id === res.supplierId);
       let status = '';
       if (i === 0) status = 'Melhor Opção';
       else if (supplier?.isCurrent) status = 'Atual';
       
       return [
         supplier?.name || '',
         formatter.format(res.energyCost),
         formatter.format(res.powerCost),
         formatter.format(res.tarCost),
         formatter.format(res.totalCost),
         formatter.format(res.monthlyCost),
         status
       ];
     });
     
     autoTable(doc, {
       startY: 40,
       head: [['Comercializador', 'Energia', 'Potência', 'TAR/Taxas', 'Total Período', 'Total Mensal', 'Status']],
       body: tableData,
       headStyles: { fillColor: brand.primaryColor },
       didParseCell: function (data: any) {
         if (data.section === 'body' && data.column.index === 6) {
           if (data.cell.raw === 'Melhor Opção') {
             data.cell.styles.textColor = '#16a34a';
             data.cell.styles.fontStyle = 'bold';
           } else if (data.cell.raw === 'Atual') {
             data.cell.styles.textColor = '#d97706';
           }
         }
       }
     });
     
     const currentRes = results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent);
     const savings = currentRes ? (currentRes.totalCost - bestResult.totalCost) : 0;
     
     let finalY = (doc as any).lastAutoTable.finalY + 20;
     
     if (savings > 0) {
       doc.setFontSize(14);
       doc.setTextColor(22, 163, 74);
       doc.text(`Poupança Estimada no Período: ${formatter.format(savings)}`, 15, finalY);
       finalY += 15;
     }
     
     doc.setFontSize(10);
     doc.setTextColor(150, 150, 150);
     doc.text('Termos e Condições:', 15, finalY);
     doc.text(brand.termsAndConditions, 15, finalY + 5, { maxWidth: 180 });
     
     if (client.consultantName) {
       doc.setTextColor(0, 0, 0);
       doc.text('Consultor Comercial:', 15, 260);
       doc.text(`${client.consultantName} | ${client.consultantPhone} | ${client.consultantEmail}`, 15, 265);
     }
     
     doc.save('Proposta_Energia_WhiteLabel.pdf');
  };

  return (
    <div className="flex flex-col xl:flex-row gap-5 h-full">
      <div className="flex flex-col gap-5 flex-1 min-w-0">
        
        {/* Current Cost Summary */}
        {results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-4">Custo Atual Est.</div>
            <div className="text-[32px] font-extrabold text-[#1e293b]">
              {formatter.format(results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent)?.monthlyCost || 0)}
              <span className="text-[14px] font-normal text-slate-500">/mês</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Comercializador: <span className="font-semibold text-[#1e293b]">{state.suppliers.find(s => s.isCurrent)?.name}</span>
            </div>
          </div>
        )}

        {/* Suppliers List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4 flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Comparativo de Propostas</div>
            <Button onClick={generatePDF} size="sm" className="h-8 bg-[#3b82f6] hover:bg-blue-600 text-white shadow-none">
              <FileText className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
          </div>
          
          <div className="flex flex-col gap-3">
            {sorted.map((res, index) => {
              const supplier = state.suppliers.find(s => s.id === res.supplierId);
              if (!supplier) return null;
              
              const isBest = index === 0;
              const isCurrent = supplier.isCurrent;
              
              const currentRes = results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent);
              const savings = currentRes && !isCurrent ? (currentRes.totalCost - res.totalCost) : 0;

              return (
                <div key={supplier.id} className={`flex items-center p-3 border rounded-lg transition-colors cursor-pointer ${
                  isBest ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-slate-200 hover:border-[#3b82f6]'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                       <span className="font-bold text-[#1e293b] truncate max-w-full">{supplier.name}</span>
                       {isBest && <span className="px-2 py-1 rounded bg-[#dcfce7] text-[#166534] text-[11px] font-bold uppercase tracking-wide">Melhor Preço</span>}
                       {isCurrent && <span className="px-2 py-1 rounded bg-[#fef3c7] text-[#92400e] text-[11px] font-bold uppercase tracking-wide">Atual</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 truncate">
                      Custo total do período: {formatter.format(res.totalCost)}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4 shrink-0">
                    <div className="font-bold text-lg text-[#1e293b]">{formatter.format(res.monthlyCost)}</div>
                    {savings > 0 && (
                      <div className="text-xs text-[#166534] font-medium">- {formatter.format(savings)} vs atual</div>
                    )}
                    {isCurrent && <div className="text-xs text-slate-500">--</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <div className="flex flex-col gap-5 w-full xl:w-[320px] shrink-0">
        
        {/* Savings visual block */}
        {results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent) && sorted[0].supplierId !== state.suppliers.find(s=>s.isCurrent)?.id && (
           <div className="text-center p-5 bg-[#1e293b] text-white rounded-xl shadow-md">
             <div className="text-xs uppercase opacity-80 font-medium tracking-wide">Poupança no Período</div>
             <div className="text-[28px] font-extrabold text-[#4ade80] my-1">
               {formatter.format((results.find(r => state.suppliers.find(s => s.id === r.supplierId)?.isCurrent)?.totalCost || 0) - bestResult.totalCost)}
             </div>
             <div className="text-[11px] opacity-60">Melhor opção: {state.suppliers.find(s=>s.id === bestResult.supplierId)?.name}</div>
           </div>
        )}

        {/* Details Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4 h-fit sticky top-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-4">Detalhes da Melhor Opção</div>
            
            <div className="space-y-3 mt-4 text-[14px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Energia</span>
                <span className="font-semibold text-[#1e293b]">{formatter.format(bestResult.energyCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Potência</span>
                <span className="font-semibold text-[#1e293b]">{formatter.format(bestResult.powerCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TARs</span>
                <span className="font-semibold text-[#1e293b]">{formatter.format(bestResult.tarCost)}</span>
              </div>
              
               <div className="flex justify-between text-xs mt-2">
                <span className="text-slate-400">FTS / CGS / mFRR</span>
                <span className="text-slate-600">{formatter.format(bestResult.ftsCost + bestResult.cgsCost + bestResult.mfrrCost)}</span>
              </div>
            </div>

            <div className="h-px bg-slate-200 my-4"></div>
            
            <div className="flex items-center justify-between font-bold text-[#1e293b] text-base">
              <span>Total no Período</span>
              <span>{formatter.format(bestResult.totalCost)}</span>
            </div>

            {/* Commissions */}
            {bestResult.commission > 0 && (
              <div className="mt-5 p-3 rounded-lg text-[13px] bg-emerald-500/10 border-l-4 border-[#10b981] text-[#065f46]">
                <strong>Comissão Margem K</strong>
                <div className="mt-2">Valor Estimado: <span className="font-bold">{formatter.format(bestResult.commission)}</span></div>
                <div className="text-[11px] mt-1 opacity-80">Extrapolação Anual p/ Pagamento</div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
