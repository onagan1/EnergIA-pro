ALTER TABLE public.comparisons 
  ADD COLUMN IF NOT EXISTS client_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consumption_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_supplier_id text DEFAULT NULL,
  ALTER COLUMN monthly_consumption SET DEFAULT 0;