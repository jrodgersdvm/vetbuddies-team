
-- 1. Add 'geneticist' to the users role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['admin','vet_buddy','dvm','client','external_vet','geneticist']));

-- 2. Add is_genetic flag to case_documents so clients can tag genetic records
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS is_genetic boolean NOT NULL DEFAULT false;

-- 3. Create genetic_insights table
CREATE TABLE IF NOT EXISTS genetic_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  authored_by uuid NOT NULL REFERENCES users(id),
  title text NOT NULL DEFAULT 'Genetic Insights',
  content text NOT NULL DEFAULT '',
  breed_risk_flags jsonb NOT NULL DEFAULT '[]',
  recommendations jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS on genetic_insights
ALTER TABLE genetic_insights ENABLE ROW LEVEL SECURITY;

-- Geneticist can insert and update their own entries
CREATE POLICY "Geneticist manage own insights"
  ON genetic_insights FOR ALL
  USING (get_my_role() = 'geneticist' AND authored_by = get_my_user_id());

-- Staff (admin, vet_buddy, dvm) can read all insights
CREATE POLICY "Staff read insights"
  ON genetic_insights FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin','vet_buddy','dvm','geneticist']));

-- Clients can read insights for their own cases
CREATE POLICY "Clients read own insights"
  ON genetic_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      JOIN pets p ON p.id = c.pet_id
      WHERE c.id = genetic_insights.case_id
        AND p.owner_id = get_my_user_id()
    )
  );

-- 4. Geneticist access to cases — read only, scoped to cases with genetic docs
CREATE POLICY "Geneticist see genetic cases"
  ON cases FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM case_documents cd
      WHERE cd.case_id = cases.id AND cd.is_genetic = true
    )
  );

-- Geneticist can read pets for those cases
CREATE POLICY "Geneticist read pets"
  ON pets FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN case_documents cd ON cd.case_id = c.id
      WHERE c.pet_id = pets.id AND cd.is_genetic = true
    )
  );

-- Geneticist can read care_plans, case_documents, medications, vaccines, vitals for genetic cases
CREATE POLICY "Geneticist read care plans"
  ON care_plans FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM case_documents cd WHERE cd.case_id = care_plans.case_id AND cd.is_genetic = true
    )
  );

CREATE POLICY "Geneticist read case documents"
  ON case_documents FOR SELECT
  USING (get_my_role() = 'geneticist');

CREATE POLICY "Geneticist read medications"
  ON pet_medications FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN case_documents cd ON cd.case_id = c.id
      WHERE c.pet_id = pet_medications.pet_id AND cd.is_genetic = true
    )
  );

CREATE POLICY "Geneticist read vaccines"
  ON pet_vaccines FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN case_documents cd ON cd.case_id = c.id
      WHERE c.pet_id = pet_vaccines.pet_id AND cd.is_genetic = true
    )
  );

CREATE POLICY "Geneticist read vitals"
  ON pet_vitals FOR SELECT
  USING (
    get_my_role() = 'geneticist' AND
    EXISTS (
      SELECT 1 FROM cases c
      JOIN case_documents cd ON cd.case_id = c.id
      WHERE c.pet_id = pet_vitals.pet_id AND cd.is_genetic = true
    )
  );
