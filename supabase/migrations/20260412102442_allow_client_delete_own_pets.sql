-- Allow clients to delete their own pets
CREATE POLICY "Clients can delete own pets" ON pets
  FOR DELETE USING (owner_id = get_my_user_id());

-- Allow admins to delete any pet
CREATE POLICY "Admins can delete pets" ON pets
  FOR DELETE USING (get_my_role() = 'admin');

-- Clean up NO ACTION foreign keys so cascade works
ALTER TABLE client_surveys DROP CONSTRAINT IF EXISTS client_surveys_case_id_fkey;
ALTER TABLE client_surveys ADD CONSTRAINT client_surveys_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE handoff_notes DROP CONSTRAINT IF EXISTS handoff_notes_case_id_fkey;
ALTER TABLE handoff_notes ADD CONSTRAINT handoff_notes_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE pending_invites DROP CONSTRAINT IF EXISTS pending_invites_case_id_fkey;
ALTER TABLE pending_invites ADD CONSTRAINT pending_invites_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
