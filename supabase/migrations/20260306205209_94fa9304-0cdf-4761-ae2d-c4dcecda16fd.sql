-- Fix: Restrict certificate uploads to user's own folder only
DROP POLICY IF EXISTS "Allow certificate upload" ON storage.objects;

CREATE POLICY "Users can only upload to own certificate folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);