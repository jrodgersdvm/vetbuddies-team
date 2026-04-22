
CREATE OR REPLACE FUNCTION calculate_lcp_completeness(p_care_plan_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_score INT := 0;
  v_pet RECORD;
  v_cp  RECORD;
  v_last_touchpoint TIMESTAMPTZ;
BEGIN
  SELECT cp.owner_context, cp.case_id, cp.pet_id INTO v_cp
  FROM care_plans cp WHERE cp.id = p_care_plan_id;
  IF v_cp IS NULL THEN RETURN 0; END IF;

  SELECT name, species, breed, dob, weight INTO v_pet
  FROM pets WHERE id = v_cp.pet_id;

  IF v_pet.name IS NOT NULL AND v_pet.species IS NOT NULL
     AND v_pet.breed IS NOT NULL AND v_pet.dob IS NOT NULL
     AND v_pet.weight IS NOT NULL AND LENGTH(v_pet.weight) > 0 THEN
    v_score := v_score + 10;
  END IF;

  IF EXISTS (SELECT 1 FROM care_plan_care_team
             WHERE care_plan_id = p_care_plan_id AND is_primary = TRUE) THEN
    v_score := v_score + 10;
  END IF;

  IF LENGTH(COALESCE(v_cp.owner_context, '')) > 100 THEN
    v_score := v_score + 15;
  END IF;

  IF EXISTS (SELECT 1 FROM care_plan_diagnoses
             WHERE care_plan_id = p_care_plan_id) THEN
    v_score := v_score + 10;
  END IF;

  IF EXISTS (SELECT 1 FROM pet_medications
             WHERE pet_id = v_cp.pet_id AND is_active = TRUE) THEN
    v_score := v_score + 10;
  END IF;

  SELECT MAX(created_at) INTO v_last_touchpoint
  FROM timeline_entries WHERE case_id = v_cp.case_id;
  IF v_last_touchpoint IS NOT NULL AND v_last_touchpoint > NOW() - INTERVAL '14 days' THEN
    v_score := v_score + 15;
  END IF;

  IF EXISTS (SELECT 1 FROM care_plan_open_questions
             WHERE care_plan_id = p_care_plan_id AND status = 'open') THEN
    v_score := v_score + 10;
  END IF;

  IF EXISTS (SELECT 1 FROM care_plan_goals
             WHERE care_plan_id = p_care_plan_id AND status = 'active') THEN
    v_score := v_score + 10;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM escalations
                 WHERE case_id = v_cp.case_id AND status = 'Open'
                   AND created_at < NOW() - INTERVAL '30 days') THEN
    v_score := v_score + 10;
  END IF;

  RETURN LEAST(v_score, 100);
END $$;

CREATE OR REPLACE FUNCTION refresh_lcp_completeness()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.care_plan_id;
  ELSE
    v_plan_id := NEW.care_plan_id;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    UPDATE care_plans
    SET completeness_score = calculate_lcp_completeness(v_plan_id),
        completeness_updated_at = NOW()
    WHERE id = v_plan_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_care_team_refresh_score
  AFTER INSERT OR UPDATE OR DELETE ON care_plan_care_team
  FOR EACH ROW EXECUTE FUNCTION refresh_lcp_completeness();
CREATE TRIGGER trg_goals_refresh_score
  AFTER INSERT OR UPDATE OR DELETE ON care_plan_goals
  FOR EACH ROW EXECUTE FUNCTION refresh_lcp_completeness();
CREATE TRIGGER trg_dx_refresh_score
  AFTER INSERT OR UPDATE OR DELETE ON care_plan_diagnoses
  FOR EACH ROW EXECUTE FUNCTION refresh_lcp_completeness();
CREATE TRIGGER trg_open_q_refresh_score
  AFTER INSERT OR UPDATE OR DELETE ON care_plan_open_questions
  FOR EACH ROW EXECUTE FUNCTION refresh_lcp_completeness();

UPDATE care_plans
SET completeness_score = calculate_lcp_completeness(id),
    completeness_updated_at = NOW();
