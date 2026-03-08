-- 1. Fix Stripe ID exposure
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;

CREATE POLICY "HR admins can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  (id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role)
);

CREATE POLICY "Employees can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  (id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'employee'::app_role)
);

REVOKE SELECT (stripe_customer_id, stripe_subscription_id, primary_contact_email, primary_contact_name) ON public.organizations FROM authenticated;
GRANT SELECT (stripe_customer_id, stripe_subscription_id, primary_contact_email, primary_contact_name) ON public.organizations TO service_role;
GRANT SELECT ON public.organizations TO postgres;

-- Recreate safe view
DROP VIEW IF EXISTS public.organizations_safe;
CREATE VIEW public.organizations_safe
WITH (security_barrier = true)
AS
SELECT id, name, logo_url, industry, plan, plan_status, plan_started_at, plan_ends_at,
  max_employees, notify_assignment, notify_completion, notify_overdue, notify_reminder,
  default_language, created_at, updated_at
FROM public.organizations;
GRANT SELECT ON public.organizations_safe TO authenticated;

-- 2. Remove employee INSERT on quiz_attempts
DROP POLICY IF EXISTS "Employees can insert own attempts" ON public.quiz_attempts;