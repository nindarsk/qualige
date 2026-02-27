
-- Trigger function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _company_name text;
  _full_name text;
BEGIN
  _company_name := NEW.raw_user_meta_data->>'company_name';
  _full_name := NEW.raw_user_meta_data->>'full_name';

  -- Create organization if company_name provided
  IF _company_name IS NOT NULL AND _company_name != '' THEN
    INSERT INTO public.organizations (name)
    VALUES (_company_name)
    RETURNING id INTO _org_id;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (NEW.id, COALESCE(_full_name, ''), _org_id);

  -- Assign hr_admin role (registering users are org creators)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'hr_admin');

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
