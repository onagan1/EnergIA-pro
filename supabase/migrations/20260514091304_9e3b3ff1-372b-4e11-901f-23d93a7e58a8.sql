
-- RLS policies for the 'comissoes' storage bucket: admin-only access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can read comissoes') THEN
    CREATE POLICY "Admins can read comissoes" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'comissoes' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can upload comissoes') THEN
    CREATE POLICY "Admins can upload comissoes" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'comissoes' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can update comissoes') THEN
    CREATE POLICY "Admins can update comissoes" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'comissoes' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can delete comissoes') THEN
    CREATE POLICY "Admins can delete comissoes" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'comissoes' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;
