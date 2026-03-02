
-- 1. Restrict employee SELECT to HR admins only (drop overly broad org-wide policy)
DROP POLICY IF EXISTS "Users can view own org employees" ON public.employees;

-- HR admins can view all org employees
CREATE POLICY "HR admins can view org employees"
ON public.employees FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'hr_admin'::app_role)
);

-- Employees can only view their own record
CREATE POLICY "Employees can view own employee record"
ON public.employees FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. Restrict organization SELECT to hide billing fields from employees
-- We can't do field-level RLS, but we ensure only HR/super_admin see org data
-- The existing policies are fine structurally; the app should not expose stripe fields to employees.
-- No change needed for org SELECT policies.

-- 3. Add UPDATE policy for organizations (HR admins only, non-billing fields managed by backend)
CREATE POLICY "HR admins can update own organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'hr_admin'::app_role)
)
WITH CHECK (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'hr_admin'::app_role)
);

-- 4. Prevent user_roles UPDATE and DELETE (no one should modify roles client-side)
-- Tables already have no UPDATE/DELETE policies = blocked by RLS. This is correct behavior.
-- But let's be explicit by adding deny-all policies for clarity:
-- Actually, with RLS enabled and no policy = denied. This is already secure. Skip.

-- 5. Prevent certificate tampering - only HR admins can delete (for admin purposes)
CREATE POLICY "HR admins can delete org certificates"
ON public.certificates FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'hr_admin'::app_role)
);

-- 6. Prevent quiz_attempts modification - make immutable (no UPDATE/DELETE = already blocked)
-- Already secure by default (no policies = denied). Skip.

-- 7. Prevent course_progress deletion - only HR admins
CREATE POLICY "HR admins can delete org progress"
ON public.course_progress FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = course_progress.employee_id
    AND e.organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'hr_admin'::app_role)
  )
);
