
-- 1. Restrict commission_tables SELECT to own profile or admin
DROP POLICY IF EXISTS "All authenticated users can read commissions" ON public.commission_tables;

CREATE POLICY "Users read own profile commissions"
  ON public.commission_tables FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR profile_id IN (
      SELECT commission_profile_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. Restrict comissoes storage writes to admins
DROP POLICY IF EXISTS "Authenticated users can upload comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete comissoes" ON storage.objects;

CREATE POLICY "Admins can upload comissoes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update comissoes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete comissoes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

-- 3. Pin search_path on SECURITY DEFINER functions missing it
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 4. Lock down SECURITY DEFINER helpers so only service_role can execute
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
