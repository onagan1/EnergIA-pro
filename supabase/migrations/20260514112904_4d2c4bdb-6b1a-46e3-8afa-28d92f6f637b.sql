DROP POLICY IF EXISTS "Admins can upload commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete comissoes" ON storage.objects;

CREATE POLICY "Admins can read comissoes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comissoes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can upload comissoes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comissoes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update comissoes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'comissoes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'comissoes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete comissoes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comissoes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);