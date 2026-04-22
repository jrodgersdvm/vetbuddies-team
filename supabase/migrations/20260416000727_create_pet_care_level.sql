
CREATE TABLE pet_care_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE UNIQUE,
  xp_total integer DEFAULT 0,
  level integer DEFAULT 1,
  streak_days integer DEFAULT 0,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE pet_care_level ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON pet_care_level FOR ALL USING (
  pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('buddy','admin','dvm'))
);
