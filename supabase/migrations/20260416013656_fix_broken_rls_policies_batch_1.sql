
-- Fix buddy_availability: u.id = auth.uid() is wrong
DROP POLICY IF EXISTS buddy_availability_access ON public.buddy_availability;
CREATE POLICY buddy_availability_access ON public.buddy_availability FOR ALL
  USING (
    buddy_id = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    buddy_id = public.current_user_id()
  );

-- Fix canned_responses: u.id = auth.uid() is wrong
DROP POLICY IF EXISTS canned_responses_staff ON public.canned_responses;
CREATE POLICY canned_responses_staff ON public.canned_responses FOR ALL
  USING (
    created_by = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    created_by = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );

-- Fix case_notes: u.id = auth.uid() is wrong
DROP POLICY IF EXISTS case_notes_staff_only ON public.case_notes;
CREATE POLICY case_notes_access ON public.case_notes FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = public.current_user_id()
         OR c.assigned_buddy_id = public.current_user_id()
    )
    OR public.current_user_role() IN ('admin', 'practice_manager', 'external_vet')
  )
  WITH CHECK (
    created_by = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );

-- Fix touchpoint_templates: u.id = auth.uid() is wrong
DROP POLICY IF EXISTS touchpoint_templates_staff ON public.touchpoint_templates;
CREATE POLICY touchpoint_templates_staff ON public.touchpoint_templates FOR ALL
  USING (
    created_by = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
  )
  WITH CHECK (
    created_by = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );
