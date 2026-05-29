-- 1. Make profile_id nullable so commissions can be global
ALTER TABLE public.commission_tables ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Replace SELECT policy to include global rows (profile_id IS NULL)
DROP POLICY IF EXISTS "Users read own profile commissions" ON public.commission_tables;

CREATE POLICY "Users read own profile commissions"
  ON public.commission_tables FOR SELECT TO authenticated
  USING (
    profile_id IS NULL
    OR has_role(auth.uid(), 'admin'::app_role)
    OR profile_id IN (
      SELECT commission_profile_id FROM public.profiles WHERE id = auth.uid()
    )
  );