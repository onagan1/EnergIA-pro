DROP POLICY IF EXISTS "Admins can read commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete commission files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete comissoes" ON storage.objects;

CREATE POLICY "Authenticated users can read comissoes"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'comissoes');

CREATE POLICY "Authenticated users can upload comissoes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comissoes');

CREATE POLICY "Authenticated users can update comissoes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'comissoes')
WITH CHECK (bucket_id = 'comissoes');

CREATE POLICY "Authenticated users can delete comissoes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'comissoes');