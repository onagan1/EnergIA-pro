ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));