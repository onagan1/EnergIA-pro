-- Create mfrr-data bucket (public, like erc-data)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mfrr-data', 'mfrr-data', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read mfrr-data"
ON storage.objects FOR SELECT
USING (bucket_id = 'mfrr-data');

-- Admin upload
CREATE POLICY "Admin upload mfrr-data"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mfrr-data' AND public.has_role(auth.uid(), 'admin'));

-- Admin update
CREATE POLICY "Admin update mfrr-data"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mfrr-data' AND public.has_role(auth.uid(), 'admin'));

-- Admin delete
CREATE POLICY "Admin delete mfrr-data"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mfrr-data' AND public.has_role(auth.uid(), 'admin'));