-- Add commission_profile_id to invitations
ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS commission_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Update handle_new_user to apply invitation's commission profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invitation_record RECORD;
  assigned_role app_role;
  assigned_profile uuid;
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
    assigned_profile := invitation_record.commission_profile_id;
  ELSE
    SELECT COUNT(*) INTO users_count FROM public.user_roles;
    IF users_count = 0 THEN
      assigned_role := 'admin';
    ELSE
      assigned_role := 'viewer';
    END IF;
    assigned_profile := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, commission_profile_id)
  VALUES (NEW.id, NEW.email, assigned_profile);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;