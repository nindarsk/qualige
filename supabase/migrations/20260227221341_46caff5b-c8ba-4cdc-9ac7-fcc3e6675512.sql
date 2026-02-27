
-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS policies for employees
CREATE POLICY "Users can view own org employees"
ON public.employees FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "HR admins can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

CREATE POLICY "HR admins can update employees"
ON public.employees FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

CREATE POLICY "HR admins can delete employees"
ON public.employees FOR DELETE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

-- Create course_assignments table
CREATE TABLE public.course_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for course_assignments
CREATE POLICY "Users can view own org assignments"
ON public.course_assignments FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "HR admins can insert assignments"
ON public.course_assignments FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

CREATE POLICY "HR admins can update assignments"
ON public.course_assignments FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

CREATE POLICY "HR admins can delete assignments"
ON public.course_assignments FOR DELETE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'hr_admin'));

-- Employees should be able to view their own assignments
CREATE POLICY "Employees can view own assignments"
ON public.course_assignments FOR SELECT
TO authenticated
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Employees can update their own assignment status
CREATE POLICY "Employees can update own assignment status"
ON public.course_assignments FOR UPDATE
TO authenticated
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Unique constraint to prevent duplicate assignments
ALTER TABLE public.course_assignments ADD CONSTRAINT unique_course_employee UNIQUE (course_id, employee_id);

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_assignments_updated_at
BEFORE UPDATE ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
