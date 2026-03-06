
-- 1. Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  action text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR admins can view org audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "Users can insert own org audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. Add org settings columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS industry text DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS notify_assignment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_overdue boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_completion boolean NOT NULL DEFAULT true;

-- 3. Add reminder columns to course_assignments
ALTER TABLE public.course_assignments
  ADD COLUMN IF NOT EXISTS reminder_3day_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_1day_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overdue_notified boolean NOT NULL DEFAULT false;

-- 4. Create org-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "HR admins can upload org logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos' AND has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "HR admins can update org logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos' AND has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "Anyone can view org logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-logos');

-- 5. Super admin policies for organizations
CREATE POLICY "Super admins can update all organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
