-- Drop the broad permissive SELECT policies on storage.objects for case-files and pet-photos
-- buckets. The tight storage_case_files_select / storage_pet_photos_select policies
-- remain and scope access correctly. Direct object URL access to public buckets is
-- unaffected — only LIST operations tighten up.

-- anon-role policies (these allow unauthenticated listing):
DROP POLICY IF EXISTS "Public read access for case files" ON storage.objects;
DROP POLICY IF EXISTS "Public read case files" ON storage.objects;
DROP POLICY IF EXISTS "Public read pet photos" ON storage.objects;

-- redundant broad authenticated SELECT policies superseded by storage_*_select:
DROP POLICY IF EXISTS "Authenticated read case files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read case files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read pet photos" ON storage.objects;
