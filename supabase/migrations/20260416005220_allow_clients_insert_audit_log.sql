DROP POLICY "Staff can insert audit log" ON audit_log;

CREATE POLICY "Authenticated users can insert audit log"
  ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
