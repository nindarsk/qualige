
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pilot',
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_employees integer NOT NULL DEFAULT 200;
