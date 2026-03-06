CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  plan_name text,
  billing_cycle text,
  requested_action text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service role can access (used by edge function)