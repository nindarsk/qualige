
-- Add unique constraint on email + organization_id to prevent duplicate employees
ALTER TABLE public.employees ADD CONSTRAINT unique_employee_email_per_org UNIQUE (email, organization_id);
