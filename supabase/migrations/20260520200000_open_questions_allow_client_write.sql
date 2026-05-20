-- Clients should be able to add questions to ask their vet. The existing
-- open_q_write policy only allowed admin/vet_buddy; add a parallel policy
-- for clients on care plans they own (can_access_care_plan returns true
-- for the case's pet owner via owner_id = get_my_user_id()).
CREATE POLICY open_q_write_client ON public.care_plan_open_questions
  FOR ALL TO authenticated
  USING (can_access_care_plan(care_plan_id) AND get_my_role() = 'client')
  WITH CHECK (can_access_care_plan(care_plan_id) AND get_my_role() = 'client');
