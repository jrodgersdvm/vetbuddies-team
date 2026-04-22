
ALTER TABLE care_plans
  ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id),
  ADD COLUMN IF NOT EXISTS owner_context TEXT,
  ADD COLUMN IF NOT EXISTS dvm_clinical_notes TEXT,
  ADD COLUMN IF NOT EXISTS completeness_score INT NOT NULL DEFAULT 0
    CHECK (completeness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS completeness_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lcp_status TEXT NOT NULL DEFAULT 'active'
    CHECK (lcp_status IN ('active','paused','archived'));

UPDATE care_plans cp
SET pet_id = c.pet_id
FROM cases c
WHERE cp.case_id = c.id AND cp.pet_id IS NULL;

ALTER TABLE care_plans
  ALTER COLUMN pet_id SET NOT NULL,
  ADD CONSTRAINT care_plans_case_id_unique UNIQUE (case_id);

CREATE INDEX IF NOT EXISTS idx_care_plans_pet_id ON care_plans(pet_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON care_plans(lcp_status)
  WHERE lcp_status = 'active';
