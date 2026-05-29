ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commercial_name text,
  ADD COLUMN IF NOT EXISTS commercial_phone text;