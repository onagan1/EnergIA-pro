UPDATE storage.buckets
SET file_size_limit = 104857600,
    allowed_mime_types = ARRAY['application/pdf','application/octet-stream']
WHERE id = 'comissoes';

UPDATE storage.buckets
SET file_size_limit = 104857600,
    allowed_mime_types = ARRAY['application/pdf','application/octet-stream']
WHERE id = 'comercializadoras';