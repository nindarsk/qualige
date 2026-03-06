-- 1. Fix storage bucket RLS: scope course-materials to organization
DROP POLICY IF EXISTS "Users can view own org course materials" ON storage.objects;

CREATE POLICY "Users can view own org course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.source_file_path = storage.objects.name
    AND courses.organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- 2. Harden handle_new_user trigger - validate employee record exists before assigning role
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
  _employee_exists boolean;
BEGIN
  _company_name := NEW.raw_user_meta_data->>'company_name';
  _full_name := NEW.raw_user_meta_data->>'full_name';
  _invited_role := NEW.raw_user_meta_data->>'role';
  _invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;

  IF _invited_role = 'employee' AND _invited_org_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.employees
      WHERE email = NEW.email
      AND organization_id = _invited_org_id
      AND user_id IS NULL
      AND status = 'pending'
    ) INTO _employee_exists;

    IF NOT _employee_exists THEN
      RAISE EXCEPTION 'Invalid employee invitation: no matching pending employee record found';
    END IF;

    INSERT INTO public.profiles (user_id, full_name, organization_id)
    VALUES (NEW.id, COALESCE(_full_name, ''), _invited_org_id)
    ON CONFLICT (user_id) DO UPDATE SET organization_id = _invited_org_id, full_name = COALESCE(_full_name, '');

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.employees
    SET user_id = NEW.id, status = 'active', joined_at = now()
    WHERE email = NEW.email AND organization_id = _invited_org_id AND user_id IS NULL;

    RETURN NEW;
  END IF;

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