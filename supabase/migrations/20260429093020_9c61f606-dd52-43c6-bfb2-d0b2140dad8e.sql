
CREATE TABLE public.price_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  supplier_name TEXT,
  discount_option TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own jobs"
  ON public.price_extraction_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own jobs"
  ON public.price_extraction_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_price_extraction_jobs_user_status ON public.price_extraction_jobs(user_id, status);
