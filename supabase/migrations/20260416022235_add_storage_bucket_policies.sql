-- Storage Bucket Policies for VetBuddies

-- CASE-FILES BUCKET

CREATE POLICY storage_case_files_insert ON storage.objects FOR INSERT
  WITH CHECK (
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

CREATE POLICY storage_case_files_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
    )
  );

CREATE POLICY storage_case_files_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'case-files'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR public.current_user_role() IN ('admin', 'practice_manager')
    )
  );


-- PET-PHOTOS BUCKET

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

CREATE POLICY storage_pet_photos_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
  );

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


-- MESSAGE ATTACHMENTS (case-files bucket, messages/ prefix)

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
