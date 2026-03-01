
-- Add storage RLS policies for certificates bucket
CREATE POLICY "Allow certificate upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Allow certificate download"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
