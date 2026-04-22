
CREATE TABLE care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES users(id),
  title text NOT NULL,
  description text,
  request_type text NOT NULL,
  status text DEFAULT 'open',
  claimed_by uuid REFERENCES users(id),
  claimed_at timestamptz,
  completed_at timestamptz,
  xp_reward integer DEFAULT 25,
  location_hint text,
  needed_by timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE care_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners can manage own requests" ON care_requests
  FOR ALL USING (owner_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "all users can read open requests" ON care_requests
  FOR SELECT USING (
    status = 'open'
    OR owner_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR claimed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
