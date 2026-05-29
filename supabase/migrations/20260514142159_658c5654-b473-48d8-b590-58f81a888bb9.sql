
-- Tabela de inclusões por comercializadora x campanha
CREATE TABLE public.supplier_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  campaign_name text,
  includes_cgs boolean NOT NULL DEFAULT false,
  includes_fts boolean NOT NULL DEFAULT false,
  includes_mfrr boolean NOT NULL DEFAULT false,
  includes_tar boolean NOT NULL DEFAULT false,
  includes_perdas boolean NOT NULL DEFAULT true,
  includes_desvios boolean NOT NULL DEFAULT false,
  cgs_threshold numeric,
  cgs_threshold_max numeric,
  threshold_behavior text NOT NULL DEFAULT 'none',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_inclusions_threshold_behavior_check
    CHECK (threshold_behavior IN ('none','excess_billed','credit_below','both'))
);

-- Índice único tratando NULL como valor (default = inclusões da comercializadora)
CREATE UNIQUE INDEX supplier_inclusions_unique
  ON public.supplier_inclusions (supplier_name, COALESCE(campaign_name, ''));

ALTER TABLE public.supplier_inclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read inclusions"
  ON public.supplier_inclusions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage inclusions"
  ON public.supplier_inclusions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER supplier_inclusions_updated_at
  BEFORE UPDATE ON public.supplier_inclusions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
