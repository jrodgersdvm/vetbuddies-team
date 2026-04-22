
-- Add SELECT policy for authenticated users on pet-photos bucket
-- This is needed for upsert uploads to work (must check if file exists)
CREATE POLICY "Authenticated read pet photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pet-photos');
