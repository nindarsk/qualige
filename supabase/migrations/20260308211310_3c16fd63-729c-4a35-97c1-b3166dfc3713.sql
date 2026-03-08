-- Add slides and image_url columns to course_modules
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT NULL;
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- Add current_slide to course_progress
ALTER TABLE public.course_progress ADD COLUMN IF NOT EXISTS current_slide integer DEFAULT 0;

-- Create course-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for course-images bucket
CREATE POLICY "Authenticated users can read course images from own org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.organization_id = public.get_user_organization_id(auth.uid())
    )
  )
);

CREATE POLICY "Service role can upload course images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-images'
  AND public.has_role(auth.uid(), 'hr_admin')
);