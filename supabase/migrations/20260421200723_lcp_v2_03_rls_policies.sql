
CREATE OR REPLACE FUNCTION can_access_care_plan(p_care_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_role     TEXT := get_my_role();
  v_user_id  UUID := get_my_user_id();
  v_case_id  UUID;
  v_pet_id   UUID;
  v_owner_id UUID;
BEGIN
  SELECT cp.case_id, cp.pet_id, p.owner_id
    INTO v_case_id, v_pet_id, v_owner_id
  FROM care_plans cp
  JOIN pets p ON p.id = cp.pet_id
  WHERE cp.id = p_care_plan_id;

  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  IF v_role = 'vet_buddy' THEN
    RETURN v_case_id = ANY (get_my_case_ids());
  END IF;
  IF v_role = 'practice_manager' THEN RETURN TRUE; END IF;
  IF v_role = 'client' THEN RETURN v_owner_id = v_user_id; END IF;
  IF v_role = 'geneticist' THEN
    RETURN EXISTS (
      SELECT 1 FROM geneticist_case_access
      WHERE case_id = v_case_id AND geneticist_id = v_user_id
    );
  END IF;
  RETURN FALSE;
END $$;

ALTER TABLE care_plan_care_team       ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_diagnoses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_open_questions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_team_read ON care_plan_care_team
  FOR SELECT TO authenticated USING (can_access_care_plan(care_plan_id));
CREATE POLICY goals_read ON care_plan_goals
  FOR SELECT TO authenticated USING (can_access_care_plan(care_plan_id));
CREATE POLICY dx_read ON care_plan_diagnoses
  FOR SELECT TO authenticated USING (can_access_care_plan(care_plan_id));
CREATE POLICY open_q_read ON care_plan_open_questions
  FOR SELECT TO authenticated USING (can_access_care_plan(care_plan_id));

CREATE POLICY care_team_write ON care_plan_care_team
  FOR ALL TO authenticated
  USING (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'))
  WITH CHECK (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'));

CREATE POLICY goals_write ON care_plan_goals
  FOR ALL TO authenticated
  USING (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'))
  WITH CHECK (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'));

CREATE POLICY dx_write ON care_plan_diagnoses
  FOR ALL TO authenticated
  USING (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'))
  WITH CHECK (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'));

CREATE POLICY open_q_write ON care_plan_open_questions
  FOR ALL TO authenticated
  USING (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'))
  WITH CHECK (can_access_care_plan(care_plan_id) AND get_my_role() IN ('admin','vet_buddy'));
