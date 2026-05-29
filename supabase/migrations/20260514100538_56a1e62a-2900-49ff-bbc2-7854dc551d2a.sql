UPDATE public.commission_tables
SET campaign_name = 'Tarifa Energy /// Condomínios'
WHERE supplier_name ILIKE '%plenitude%'
  AND campaign_name = 'Tarifa Energy + /// Condomínios'
  AND criteria_type = 'consumo_anual';