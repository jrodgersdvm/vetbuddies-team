
CREATE TABLE user_care_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  assists_given integer DEFAULT 0,
  assists_received integer DEFAULT 0,
  teams_joined integer DEFAULT 0,
  teams_built integer DEFAULT 0,
  community_score integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_care_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own stats" ON user_care_stats
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('buddy','admin','dvm'))
  );
