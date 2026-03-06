
-- 1. Add RLS policies to demo_requests table
CREATE POLICY "Super admins can view all demo requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete demo requests"
  ON public.demo_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can insert demo requests"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2. Drop the privilege escalation policy on user_roles
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- 3. Add language column to profiles for i18n
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
