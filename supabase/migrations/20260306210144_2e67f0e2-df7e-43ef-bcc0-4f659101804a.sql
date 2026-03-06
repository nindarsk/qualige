-- Replace overly permissive INSERT policy on demo_requests with field validation
DROP POLICY IF EXISTS "Anyone can insert demo requests" ON public.demo_requests;

CREATE POLICY "Anyone can insert demo requests with validation"
ON public.demo_requests
FOR INSERT
WITH CHECK (
  full_name IS NOT NULL AND full_name <> '' AND
  email IS NOT NULL AND email <> '' AND
  organization_name IS NOT NULL AND organization_name <> '' AND
  type IS NOT NULL AND type <> '' AND
  length(full_name) <= 200 AND
  length(email) <= 320 AND
  length(organization_name) <= 200 AND
  length(COALESCE(message, '')) <= 5000
);