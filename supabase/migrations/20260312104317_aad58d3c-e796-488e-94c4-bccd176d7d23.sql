
-- Create erc-data bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('erc-data', 'erc-data', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read erc-data"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'erc-data');

-- Allow service role to upload
CREATE POLICY "Service role upload erc-data"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'erc-data');

CREATE POLICY "Service role update erc-data"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'erc-data');

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
