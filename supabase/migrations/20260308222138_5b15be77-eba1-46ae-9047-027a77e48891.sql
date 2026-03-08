
-- Add generation_method to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS generation_method text NOT NULL DEFAULT 'document';

-- Add new columns to quiz_questions table
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS scenario text;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS regulation_reference text;
