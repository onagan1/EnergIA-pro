-- Ensure bucket 'comercializadoras' exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comercializadoras',
  'comercializadoras',
  true,
  104857600,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure bucket 'PDF' exists and is private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'PDF',
  'PDF',
  false,
  104857600,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remove old policies to prevent conflicts
DROP POLICY IF EXISTS "Public read comercializadoras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload comercializadoras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update comercializadoras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete comercializadoras" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated select PDF" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert PDF" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update PDF" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete PDF" ON storage.objects;

-- Policies for 'comercializadoras' bucket
CREATE POLICY "Public read comercializadoras"
ON storage.objects FOR SELECT
USING (bucket_id = 'comercializadoras');

CREATE POLICY "Authenticated upload comercializadoras"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comercializadoras');

CREATE POLICY "Authenticated update comercializadoras"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'comercializadoras');

CREATE POLICY "Authenticated delete comercializadoras"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comercializadoras');

-- Policies for 'PDF' bucket
CREATE POLICY "Authenticated select PDF"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'PDF');

CREATE POLICY "Authenticated insert PDF"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'PDF');

CREATE POLICY "Authenticated update PDF"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'PDF');

CREATE POLICY "Authenticated delete PDF"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'PDF');
