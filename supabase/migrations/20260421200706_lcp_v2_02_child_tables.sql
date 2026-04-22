
CREATE TABLE IF NOT EXISTS care_plan_care_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  role TEXT,
  clinic_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_care_team_plan ON care_plan_care_team(care_plan_id);

CREATE TABLE IF NOT EXISTS care_plan_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL,
  set_by_owner BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','achieved','paused','dropped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goals_plan ON care_plan_goals(care_plan_id);

CREATE TABLE IF NOT EXISTS care_plan_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  diagnosing_vet TEXT,
  diagnosed_on DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','managed','resolved','ruled_out')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_dx_plan ON care_plan_diagnoses(care_plan_id);

CREATE TABLE IF NOT EXISTS care_plan_open_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  context TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent','normal','whenever')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','asked','answered','moot')),
  resolution_notes TEXT,
  target_visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_open_q_plan ON care_plan_open_questions(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_open_q_status
  ON care_plan_open_questions(status) WHERE status = 'open';

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON care_plan_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dx_updated BEFORE UPDATE ON care_plan_diagnoses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_open_q_updated BEFORE UPDATE ON care_plan_open_questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
