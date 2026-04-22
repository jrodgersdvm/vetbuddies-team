-- Allow authenticated users to upload to case-files bucket
CREATE POLICY "Authenticated users can upload case files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-files');

-- Allow authenticated users to read case files
CREATE POLICY "Authenticated users can read case files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'case-files');

-- Allow public read access (needed for AI edge function to fetch docs)
CREATE POLICY "Public read access for case files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'case-files');
