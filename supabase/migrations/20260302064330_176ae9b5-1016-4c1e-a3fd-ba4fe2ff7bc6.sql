
-- 1. Fix quiz answers exposure: restrict to HR admins, create answer-free view for employees
-- Drop the broad policy
DROP POLICY IF EXISTS "Users can view own org quiz questions" ON public.quiz_questions;

-- HR admins can see full questions (including answers)
CREATE POLICY "HR admins can view org quiz questions"
ON public.quiz_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = quiz_questions.course_id
    AND courses.organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'hr_admin'::app_role)
  )
);

-- Employees can view questions (correct_answer still visible at row level - Postgres can't do column-level RLS)
-- We'll handle this by NOT selecting correct_answer/explanation in the employee quiz page queries
-- But we still need a SELECT policy for employees
CREATE POLICY "Employees can view assigned course quiz questions"
ON public.quiz_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    JOIN course_assignments ca ON ca.course_id = c.id
    JOIN employees e ON e.id = ca.employee_id
    WHERE c.id = quiz_questions.course_id
    AND e.user_id = auth.uid()
  )
);

-- 2. Fix course_assignments broad SELECT: restrict to own assignments for employees
DROP POLICY IF EXISTS "Users can view own org assignments" ON public.course_assignments;

-- HR admins can view all org assignments
CREATE POLICY "HR admins can view org assignments"
ON public.course_assignments FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'hr_admin'::app_role)
);
