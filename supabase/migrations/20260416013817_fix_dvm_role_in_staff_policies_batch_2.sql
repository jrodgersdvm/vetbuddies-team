
-- appointments
DROP POLICY IF EXISTS "Staff see appointments" ON public.appointments;
CREATE POLICY "Staff see appointments" ON public.appointments FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- timeline_entries
DROP POLICY IF EXISTS "Staff see timeline" ON public.timeline_entries;
CREATE POLICY "Staff see timeline" ON public.timeline_entries FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- touchpoints
DROP POLICY IF EXISTS "Staff see touchpoints" ON public.touchpoints;
CREATE POLICY "Staff see touchpoints" ON public.touchpoints FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- escalations
DROP POLICY IF EXISTS "Staff see escalations" ON public.escalations;
CREATE POLICY "Staff see escalations" ON public.escalations FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- genetic_insights
DROP POLICY IF EXISTS "Staff read insights" ON public.genetic_insights;
CREATE POLICY "Staff read insights" ON public.genetic_insights FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager', 'geneticist', 'external_vet'));

-- pending_invites
DROP POLICY IF EXISTS "Staff read invites" ON public.pending_invites;
CREATE POLICY "Staff read invites" ON public.pending_invites FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- case_documents
DROP POLICY IF EXISTS "Users can view docs for their cases" ON public.case_documents;
CREATE POLICY "Users can view docs for their cases" ON public.case_documents FOR SELECT
  USING (
    public.current_user_role() IN ('admin', 'vet_buddy', 'external_vet', 'practice_manager')
    OR case_id = ANY (get_my_case_ids())
  );
