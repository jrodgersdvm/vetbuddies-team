
-- Admin-only write on dvm_response (same pattern as dvm_clinical_notes guard)
CREATE OR REPLACE FUNCTION guard_dvm_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.dvm_response IS DISTINCT FROM OLD.dvm_response
     AND get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can modify dvm_response (role: %)', get_my_role();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_escalations_guard_dvm_response
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION guard_dvm_response();
