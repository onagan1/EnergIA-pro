-- Step 1: Drop old structures
DROP TABLE IF EXISTS public.commission_tables CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS commission_profile_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS margin_commission_pct;
ALTER TABLE public.user_invitations DROP COLUMN IF EXISTS commission_profile_id;

-- Empty comissoes bucket via Storage API
DO $$
BEGIN
  PERFORM storage.empty_bucket('comissoes');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Update handle_new_user to remove references to dropped columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invitation_record RECORD;
  assigned_role app_role;
  users_count INTEGER;
BEGIN
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE email = NEW.email
    AND used_at IS NULL
    AND expires_at > now();

  IF invitation_record IS NOT NULL THEN
    UPDATE public.user_invitations
    SET used_at = now()
    WHERE id = invitation_record.id;
    assigned_role := invitation_record.role;
  ELSE
    SELECT COUNT(*) INTO users_count FROM public.user_roles;
    IF users_count = 0 THEN
      assigned_role := 'admin';
    ELSE
      RAISE EXCEPTION 'Registration requires a valid invitation. Contact an administrator.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;

-- Step 2: New structure

CREATE TABLE public.commission_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.commission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_profiles"
ON public.commission_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read commission_profiles"
ON public.commission_profiles FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_commission_profiles_updated_at
BEFORE UPDATE ON public.commission_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.commission_profile_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES public.commission_profiles(id) ON DELETE CASCADE,
  margin_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_profile_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage assignments"
ON public.commission_profile_assignments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own assignment"
ON public.commission_profile_assignments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_assignments_updated_at
BEFORE UPDATE ON public.commission_profile_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.commission_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.commission_profiles(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  campaign_name TEXT,
  basis TEXT NOT NULL CHECK (basis IN ('power','consumption','margin_k')),
  criteria_type TEXT,
  criteria_value TEXT,
  commission_value NUMERIC NOT NULL DEFAULT 0,
  commission_unit TEXT NOT NULL DEFAULT 'euro',
  payment_mode TEXT NOT NULL DEFAULT 'one_shot' CHECK (payment_mode IN ('one_shot','recurring')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_tables"
ON public.commission_tables FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read tables of their profile"
ON public.commission_tables FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR profile_id IN (
    SELECT profile_id FROM public.commission_profile_assignments
    WHERE user_id = auth.uid()
  )
);

CREATE INDEX idx_commission_tables_profile ON public.commission_tables(profile_id);

CREATE TRIGGER trg_commission_tables_updated_at
BEFORE UPDATE ON public.commission_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for comissoes bucket (admin only)
DO $$
BEGIN
  -- Ensure bucket exists
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('comissoes', 'comissoes', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "Admins read comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins update comissoes" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete comissoes" ON storage.objects;

CREATE POLICY "Admins read comissoes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins upload comissoes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update comissoes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete comissoes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'::app_role));