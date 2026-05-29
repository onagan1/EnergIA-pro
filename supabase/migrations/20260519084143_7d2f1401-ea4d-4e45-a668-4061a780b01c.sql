
-- 1. Explicit SELECT policy for admins on user_invitations
CREATE POLICY "Admins can view invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. UPDATE / DELETE policies for price_extraction_jobs
CREATE POLICY "Users update own jobs"
ON public.price_extraction_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own jobs"
ON public.price_extraction_jobs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Block uninvited self-registration
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
      assigned_profile := NULL;
    ELSE
      -- Block self-registration without invitation
      RAISE EXCEPTION 'Registration requires a valid invitation. Contact an administrator.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, commission_profile_id)
  VALUES (NEW.id, NEW.email, assigned_profile);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;

-- 4. Restrict EXECUTE on SECURITY DEFINER helpers
-- Trigger-only functions: revoke from everyone (triggers bypass EXECUTE checks)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Role check helpers: revoke from anon (still needed by authenticated for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
