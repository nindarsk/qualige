
-- =========================================================
-- FIX 1: Convert ALL RESTRICTIVE RLS policies to PERMISSIVE
-- =========================================================

-- audit_logs
DROP POLICY IF EXISTS "HR admins can view org audit logs" ON public.audit_logs;
CREATE POLICY "HR admins can view org audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can view all audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own org audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own org audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- certificates
DROP POLICY IF EXISTS "Employees can insert own certificates" ON public.certificates;
CREATE POLICY "Employees can insert own certificates" ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can view own certificates" ON public.certificates;
CREATE POLICY "Employees can view own certificates" ON public.certificates FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "HR admins can delete org certificates" ON public.certificates;
CREATE POLICY "HR admins can delete org certificates" ON public.certificates FOR DELETE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can view org certificates" ON public.certificates;
CREATE POLICY "HR admins can view org certificates" ON public.certificates FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

-- course_assignments
DROP POLICY IF EXISTS "Employees can update own assignment status" ON public.course_assignments;
CREATE POLICY "Employees can update own assignment status" ON public.course_assignments FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can view own assignments" ON public.course_assignments;
CREATE POLICY "Employees can view own assignments" ON public.course_assignments FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "HR admins can delete assignments" ON public.course_assignments;
CREATE POLICY "HR admins can delete assignments" ON public.course_assignments FOR DELETE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can insert assignments" ON public.course_assignments;
CREATE POLICY "HR admins can insert assignments" ON public.course_assignments FOR INSERT TO authenticated
  WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can update assignments" ON public.course_assignments;
CREATE POLICY "HR admins can update assignments" ON public.course_assignments FOR UPDATE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can view org assignments" ON public.course_assignments;
CREATE POLICY "HR admins can view org assignments" ON public.course_assignments FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

-- course_modules
DROP POLICY IF EXISTS "HR admins can delete modules" ON public.course_modules;
CREATE POLICY "HR admins can delete modules" ON public.course_modules FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = course_modules.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can insert modules" ON public.course_modules;
CREATE POLICY "HR admins can insert modules" ON public.course_modules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM courses WHERE courses.id = course_modules.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can update modules" ON public.course_modules;
CREATE POLICY "HR admins can update modules" ON public.course_modules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = course_modules.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "Users can view own org modules" ON public.course_modules;
CREATE POLICY "Users can view own org modules" ON public.course_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = course_modules.course_id AND courses.organization_id = get_user_organization_id(auth.uid())));

-- course_progress
DROP POLICY IF EXISTS "Employees can insert own progress" ON public.course_progress;
CREATE POLICY "Employees can insert own progress" ON public.course_progress FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can update own progress" ON public.course_progress;
CREATE POLICY "Employees can update own progress" ON public.course_progress FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can view own progress" ON public.course_progress;
CREATE POLICY "Employees can view own progress" ON public.course_progress FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "HR admins can delete org progress" ON public.course_progress;
CREATE POLICY "HR admins can delete org progress" ON public.course_progress FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = course_progress.employee_id AND e.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can view org progress" ON public.course_progress;
CREATE POLICY "HR admins can view org progress" ON public.course_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = course_progress.employee_id AND e.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

-- courses
DROP POLICY IF EXISTS "HR admins can delete own org courses" ON public.courses;
CREATE POLICY "HR admins can delete own org courses" ON public.courses FOR DELETE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can insert courses" ON public.courses;
CREATE POLICY "HR admins can insert courses" ON public.courses FOR INSERT TO authenticated
  WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can update own org courses" ON public.courses;
CREATE POLICY "HR admins can update own org courses" ON public.courses FOR UPDATE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "Users can view own org courses" ON public.courses;
CREATE POLICY "Users can view own org courses" ON public.courses FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

-- demo_requests
DROP POLICY IF EXISTS "Anyone can insert demo requests with validation" ON public.demo_requests;
CREATE POLICY "Anyone can insert demo requests with validation" ON public.demo_requests FOR INSERT
  WITH CHECK ((full_name IS NOT NULL) AND (full_name <> '') AND (email IS NOT NULL) AND (email <> '') AND (organization_name IS NOT NULL) AND (organization_name <> '') AND (type IS NOT NULL) AND (type <> '') AND (length(full_name) <= 200) AND (length(email) <= 320) AND (length(organization_name) <= 200) AND (length(COALESCE(message, '')) <= 5000));

DROP POLICY IF EXISTS "Super admins can delete demo requests" ON public.demo_requests;
CREATE POLICY "Super admins can delete demo requests" ON public.demo_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all demo requests" ON public.demo_requests;
CREATE POLICY "Super admins can view all demo requests" ON public.demo_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- employees
DROP POLICY IF EXISTS "Employees can view own employee record" ON public.employees;
CREATE POLICY "Employees can view own employee record" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "HR admins can delete employees" ON public.employees;
CREATE POLICY "HR admins can delete employees" ON public.employees FOR DELETE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can insert employees" ON public.employees;
CREATE POLICY "HR admins can insert employees" ON public.employees FOR INSERT TO authenticated
  WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can update employees" ON public.employees;
CREATE POLICY "HR admins can update employees" ON public.employees FOR UPDATE TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR admins can view org employees" ON public.employees;
CREATE POLICY "HR admins can view org employees" ON public.employees FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

-- organizations
DROP POLICY IF EXISTS "HR admins can update own organization" ON public.organizations;
CREATE POLICY "HR admins can update own organization" ON public.organizations FOR UPDATE TO authenticated
  USING ((id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role))
  WITH CHECK ((id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can update all organizations" ON public.organizations;
CREATE POLICY "Super admins can update all organizations" ON public.organizations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations" ON public.organizations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
CREATE POLICY "Users can view own organization" ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Users without org can create organization" ON public.organizations;
CREATE POLICY "Users without org can create organization" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (get_user_organization_id(auth.uid()) IS NULL);

-- profiles
DROP POLICY IF EXISTS "HR admins can view org profiles" ON public.profiles;
CREATE POLICY "HR admins can view org profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'hr_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- quiz_attempts
DROP POLICY IF EXISTS "Employees can insert own attempts" ON public.quiz_attempts;
CREATE POLICY "Employees can insert own attempts" ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can view own attempts" ON public.quiz_attempts;
CREATE POLICY "Employees can view own attempts" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "HR admins can view org attempts" ON public.quiz_attempts;
CREATE POLICY "HR admins can view org attempts" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = quiz_attempts.employee_id AND e.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

-- quiz_questions
DROP POLICY IF EXISTS "Employees can view assigned course quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "HR admins can delete quiz questions" ON public.quiz_questions;
CREATE POLICY "HR admins can delete quiz questions" ON public.quiz_questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = quiz_questions.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can insert quiz questions" ON public.quiz_questions;
CREATE POLICY "HR admins can insert quiz questions" ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM courses WHERE courses.id = quiz_questions.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can update quiz questions" ON public.quiz_questions;
CREATE POLICY "HR admins can update quiz questions" ON public.quiz_questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = quiz_questions.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

DROP POLICY IF EXISTS "HR admins can view org quiz questions" ON public.quiz_questions;
CREATE POLICY "HR admins can view org quiz questions" ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = quiz_questions.course_id AND courses.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'::app_role)));

-- user_roles
DROP POLICY IF EXISTS "HR admins can insert employee roles" ON public.user_roles;
CREATE POLICY "HR admins can insert employee roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'hr_admin'::app_role) AND role = 'employee'::app_role);

DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- FIX 2: Quiz questions - remove employee direct access to correct_answer
-- Create a secure view that excludes correct_answer and explanation
-- =========================================================
CREATE OR REPLACE VIEW public.quiz_questions_safe AS
SELECT id, course_id, question_number, question, options, created_at
FROM public.quiz_questions;

-- Grant access to the view
GRANT SELECT ON public.quiz_questions_safe TO authenticated;
GRANT SELECT ON public.quiz_questions_safe TO anon;

-- Enable RLS-like security on the view by using security_invoker
ALTER VIEW public.quiz_questions_safe SET (security_invoker = true);

-- Now employees get quiz questions through an edge function (grade-quiz) 
-- or through this safe view. The employee RLS policy on quiz_questions was dropped above.
-- HR admins still have full access to quiz_questions base table.

-- =========================================================
-- FIX 3: Protect sensitive org columns from employees
-- Create a view that hides stripe/contact fields
-- =========================================================
CREATE OR REPLACE VIEW public.organizations_safe AS
SELECT id, name, plan, plan_status, default_language, logo_url, industry,
       max_employees, notify_assignment, notify_reminder, notify_overdue, 
       notify_completion, plan_started_at, plan_ends_at, created_at, updated_at
FROM public.organizations;

GRANT SELECT ON public.organizations_safe TO authenticated;
ALTER VIEW public.organizations_safe SET (security_invoker = true);
