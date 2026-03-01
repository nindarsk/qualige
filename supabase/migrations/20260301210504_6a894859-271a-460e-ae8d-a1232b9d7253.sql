
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org_id uuid;
  _company_name text;
  _full_name text;
  _invited_role text;
  _invited_org_id uuid;
BEGIN
  _company_name := NEW.raw_user_meta_data->>'company_name';
  _full_name := NEW.raw_user_meta_data->>'full_name';
  _invited_role := NEW.raw_user_meta_data->>'role';
  _invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;

  -- If this is an invited employee, set up differently
  IF _invited_role = 'employee' AND _invited_org_id IS NOT NULL THEN
    -- Create profile linked to the inviting organization
    INSERT INTO public.profiles (user_id, full_name, organization_id)
    VALUES (NEW.id, COALESCE(_full_name, ''), _invited_org_id)
    ON CONFLICT (user_id) DO UPDATE SET organization_id = _invited_org_id, full_name = COALESCE(_full_name, '');

    -- Assign employee role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Link employee record
    UPDATE public.employees
    SET user_id = NEW.id, status = 'active', joined_at = now()
    WHERE email = NEW.email AND organization_id = _invited_org_id AND user_id IS NULL;

    RETURN NEW;
  END IF;

  -- Regular registration flow (HR Admin creating org)
  IF _company_name IS NOT NULL AND _company_name != '' THEN
    INSERT INTO public.organizations (name)
    VALUES (_company_name)
    RETURNING id INTO _org_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (NEW.id, COALESCE(_full_name, ''), _org_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'hr_admin');

  RETURN NEW;
END;
$function$;
