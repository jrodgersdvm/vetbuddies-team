
CREATE TABLE user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  badge_label text NOT NULL,
  earned_at timestamptz DEFAULT now()
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own badges" ON user_badges
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('buddy','admin','dvm'))
  );
