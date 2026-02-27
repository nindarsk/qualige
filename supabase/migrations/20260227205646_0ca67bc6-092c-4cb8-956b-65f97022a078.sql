
-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  language TEXT NOT NULL DEFAULT 'English',
  duration_minutes INTEGER,
  learning_objectives TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  source_file_path TEXT,
  source_youtube_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course_modules table
CREATE TABLE public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  key_points TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL DEFAULT '{}',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Courses RLS policies
CREATE POLICY "Users can view own org courses"
  ON public.courses FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "HR admins can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'hr_admin')
  );

CREATE POLICY "HR admins can update own org courses"
  ON public.courses FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'hr_admin')
  );

CREATE POLICY "HR admins can delete own org courses"
  ON public.courses FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'hr_admin')
  );

-- Course modules RLS policies (access via course's org)
CREATE POLICY "Users can view own org modules"
  ON public.course_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "HR admins can insert modules"
  ON public.course_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

CREATE POLICY "HR admins can update modules"
  ON public.course_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

CREATE POLICY "HR admins can delete modules"
  ON public.course_modules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

-- Quiz questions RLS policies
CREATE POLICY "Users can view own org quiz questions"
  ON public.quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = quiz_questions.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "HR admins can insert quiz questions"
  ON public.quiz_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = quiz_questions.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

CREATE POLICY "HR admins can update quiz questions"
  ON public.quiz_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = quiz_questions.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

CREATE POLICY "HR admins can delete quiz questions"
  ON public.quiz_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = quiz_questions.course_id
      AND courses.organization_id = get_user_organization_id(auth.uid())
      AND has_role(auth.uid(), 'hr_admin')
    )
  );

-- Updated_at triggers
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for course materials
INSERT INTO storage.buckets (id, name, public) VALUES ('course-materials', 'course-materials', false);

-- Storage policies
CREATE POLICY "HR admins can upload course materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-materials'
    AND has_role(auth.uid(), 'hr_admin')
  );

CREATE POLICY "Users can view own org course materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-materials'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "HR admins can delete course materials"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'course-materials'
    AND has_role(auth.uid(), 'hr_admin')
  );
