-- ============================================
-- Storage Bucket Policies for VetBuddies
-- ============================================
-- Run this migration in the Supabase SQL Editor.
-- Adds RLS policies on storage.objects so authenticated
-- users can upload/download/delete files in the case-files
-- and pet-photos buckets via the client SDK.

-- ════════════════════════════════════════════
-- CASE-FILES BUCKET
-- ════════════════════════════════════════════

-- Clients, buddies, external vets, and admins can upload files to their cases
CREATE POLICY storage_case_files_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      -- Extract case ID from path: cases/{caseId}/...
      (storage.foldername(name))[1] = 'cases'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT c.id FROM public.cases c
        JOIN public.pets p ON p.id = c.pet_id
        WHERE p.owner_id = public.current_user_id()
           OR c.assigned_buddy_id = public.current_user_id()
      )
      OR (storage.foldername(name))[1] = 'cases'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT case_id FROM public.case_access WHERE user_id = public.current_user_id()
      )
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );

-- Anyone with case access can read/download files
CREATE POLICY storage_case_files_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'cases'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT c.id FROM public.cases c
        JOIN public.pets p ON p.id = c.pet_id
        WHERE p.owner_id = public.current_user_id()
           OR c.assigned_buddy_id = public.current_user_id()
      )
      OR (storage.foldername(name))[1] = 'cases'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT case_id FROM public.case_access WHERE user_id = public.current_user_id()
      )
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );

-- Staff and admins can delete files; clients can delete their own uploads
CREATE POLICY storage_case_files_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
    )
  );

-- Allow updates (e.g. upsert) for users who can insert
CREATE POLICY storage_case_files_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );


-- ════════════════════════════════════════════
-- PET-PHOTOS BUCKET
-- ════════════════════════════════════════════

-- Pet owners can upload photos for their pets
CREATE POLICY storage_pet_photos_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'pets'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM public.pets WHERE owner_id = public.current_user_id()
      )
      OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
    )
  );

-- Anyone authenticated can view pet photos
CREATE POLICY storage_pet_photos_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
  );

-- Pet owners and staff can update/delete pet photos
CREATE POLICY storage_pet_photos_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
    )
  );

CREATE POLICY storage_pet_photos_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
    )
  );


-- ════════════════════════════════════════════
-- MESSAGE ATTACHMENTS (also in case-files bucket)
-- ════════════════════════════════════════════
-- Message attachments use path: messages/{caseId}/...
-- Covered by the same case-files policies above since
-- we check bucket_id and the path starts with a folder name.
-- Add explicit policy for the messages/ prefix:

CREATE POLICY storage_case_files_messages_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'messages'
    AND (
      (storage.foldername(name))[2]::uuid IN (
        SELECT c.id FROM public.cases c
        JOIN public.pets p ON p.id = c.pet_id
        WHERE p.owner_id = public.current_user_id()
           OR c.assigned_buddy_id = public.current_user_id()
      )
      OR (storage.foldername(name))[2]::uuid IN (
        SELECT case_id FROM public.case_access WHERE user_id = public.current_user_id()
      )
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );

CREATE POLICY storage_case_files_messages_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'messages'
    AND (
      (storage.foldername(name))[2]::uuid IN (
        SELECT c.id FROM public.cases c
        JOIN public.pets p ON p.id = c.pet_id
        WHERE p.owner_id = public.current_user_id()
           OR c.assigned_buddy_id = public.current_user_id()
      )
      OR (storage.foldername(name))[2]::uuid IN (
        SELECT case_id FROM public.case_access WHERE user_id = public.current_user_id()
      )
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );
