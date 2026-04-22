
-- Drop the circular policies
DROP POLICY IF EXISTS "Geneticist see genetic cases" ON cases;
DROP POLICY IF EXISTS "Geneticist read case documents" ON case_documents;
DROP POLICY IF EXISTS "Geneticist read care plans" ON care_plans;
DROP POLICY IF EXISTS "Geneticist read medications" ON pet_medications;
DROP POLICY IF EXISTS "Geneticist read vaccines" ON pet_vaccines;
DROP POLICY IF EXISTS "Geneticist read vitals" ON pet_vitals;
DROP POLICY IF EXISTS "Geneticist read pets" ON pets;

-- Create a separate table to track geneticist case access
-- This avoids the circular case_documents <-> cases reference
CREATE TABLE IF NOT EXISTS geneticist_case_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  geneticist_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(case_id, geneticist_id)
);

ALTER TABLE geneticist_case_access ENABLE ROW LEVEL SECURITY;

-- Admin can manage geneticist access
CREATE POLICY "Admin manage geneticist access"
  ON geneticist_case_access FOR ALL
  USING (get_my_role() = 'admin');

-- Geneticist can see their own access records
CREATE POLICY "Geneticist see own access"
  ON geneticist_case_access FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    geneticist_id = get_my_user_id()
  );

-- Now recreate geneticist cases policy using the access table (no recursion)
CREATE POLICY "Geneticist see assigned cases"
  ON cases FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM geneticist_case_access gca
      WHERE gca.case_id = cases.id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read pets for assigned cases (no case_documents join)
CREATE POLICY "Geneticist read assigned pets"
  ON pets FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN geneticist_case_access gca ON gca.case_id = c.id
      WHERE c.pet_id = pets.id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read care plans for assigned cases
CREATE POLICY "Geneticist read assigned care plans"
  ON care_plans FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM geneticist_case_access gca
      WHERE gca.case_id = care_plans.case_id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read case documents for assigned cases
CREATE POLICY "Geneticist read assigned documents"
  ON case_documents FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM geneticist_case_access gca
      WHERE gca.case_id = case_documents.case_id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read medications for assigned cases
CREATE POLICY "Geneticist read assigned medications"
  ON pet_medications FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN geneticist_case_access gca ON gca.case_id = c.id
      WHERE c.pet_id = pet_medications.pet_id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read vaccines for assigned cases
CREATE POLICY "Geneticist read assigned vaccines"
  ON pet_vaccines FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN geneticist_case_access gca ON gca.case_id = c.id
      WHERE c.pet_id = pet_vaccines.pet_id
        AND gca.geneticist_id = get_my_user_id()
    )
  );

-- Geneticist read vitals for assigned cases
CREATE POLICY "Geneticist read assigned vitals"
  ON pet_vitals FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN geneticist_case_access gca ON gca.case_id = c.id
      WHERE c.pet_id = pet_vitals.pet_id
        AND gca.geneticist_id = get_my_user_id()
    )
  );
