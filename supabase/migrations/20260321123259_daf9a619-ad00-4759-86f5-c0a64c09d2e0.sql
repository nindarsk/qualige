CREATE POLICY "Employees can view quiz questions for assigned courses"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM course_assignments ca
    JOIN employees e ON e.id = ca.employee_id
    WHERE ca.course_id = quiz_questions.course_id
      AND e.user_id = auth.uid()
  )
);