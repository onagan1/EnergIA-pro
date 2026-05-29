
-- Restringir policies das novas tabelas apenas a authenticated
DROP POLICY "Users can view own profiles" ON public.user_profiles;
DROP POLICY "Users can create own profiles" ON public.user_profiles;
DROP POLICY "Users can update own profiles" ON public.user_profiles;
DROP POLICY "Users can delete own profiles" ON public.user_profiles;

CREATE POLICY "Users can view own profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own profiles"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own profiles"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY "Admins full access commissions" ON public.commission_tables;
DROP POLICY "Users can read own profile commissions" ON public.commission_tables;

CREATE POLICY "Admins full access commissions"
  ON public.commission_tables FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own profile commissions"
  ON public.commission_tables FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = commission_tables.profile_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- Storage policies also restrict to authenticated
DROP POLICY "Admins can upload commission files" ON storage.objects;
DROP POLICY "Admins can read commission files" ON storage.objects;
DROP POLICY "Admins can delete commission files" ON storage.objects;

CREATE POLICY "Admins can upload commission files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read commission files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete commission files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));
