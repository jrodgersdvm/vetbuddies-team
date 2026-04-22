
-- Function: create a case automatically whenever a pet is added
CREATE OR REPLACE FUNCTION create_case_for_new_pet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cases (pet_id, assigned_buddy_id, status, subscription_tier)
  VALUES (NEW.id, NULL, 'Active', 'Buddy');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after every new row in pets
CREATE TRIGGER auto_create_case_on_pet_insert
AFTER INSERT ON pets
FOR EACH ROW
EXECUTE FUNCTION create_case_for_new_pet();
