
CREATE OR REPLACE FUNCTION guard_dvm_clinical_notes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.dvm_clinical_notes IS DISTINCT FROM OLD.dvm_clinical_notes
     AND get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can modify dvm_clinical_notes (role: %)', get_my_role();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_care_plans_guard_dvm
  BEFORE UPDATE ON care_plans
  FOR EACH ROW EXECUTE FUNCTION guard_dvm_clinical_notes();
