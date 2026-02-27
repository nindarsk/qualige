
-- Fix organizations policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Users without org can create organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;

CREATE POLICY "Users without org can create organization"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (get_user_organization_id(auth.uid()) IS NULL);

CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT TO authenticated
USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Fix profiles policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "HR admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "HR admins can view org profiles"
ON public.profiles FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Fix user_roles policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "HR admins can insert employee roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;

CREATE POLICY "Users can insert own roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "HR admins can insert employee roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'hr_admin'::app_role) AND role = 'employee'::app_role);

CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
