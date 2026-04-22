
CREATE TABLE pet_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  badge_label text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  display_order integer DEFAULT 0
);
ALTER TABLE pet_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON pet_badges FOR ALL USING (
  pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('buddy','admin','dvm'))
);
