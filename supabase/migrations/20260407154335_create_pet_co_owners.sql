
-- Junction table for multi-owner pet access
CREATE TABLE pet_co_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(pet_id, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_pet_co_owners_user ON pet_co_owners(user_id);
CREATE INDEX idx_pet_co_owners_pet ON pet_co_owners(pet_id);
CREATE INDEX idx_pet_co_owners_email ON pet_co_owners(invited_email);

-- RLS
ALTER TABLE pet_co_owners ENABLE ROW LEVEL SECURITY;

-- Co-owners can see their own records
CREATE POLICY "Users can view their own co-owner records"
  ON pet_co_owners FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Pet owners can see co-owners of their pets
CREATE POLICY "Pet owners can view co-owners of their pets"
  ON pet_co_owners FOR SELECT
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = (SELECT id FROM users WHERE auth_id = auth.uid())));

-- Pet owners can insert co-owner invites for their pets
CREATE POLICY "Pet owners can invite co-owners"
  ON pet_co_owners FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE owner_id = (SELECT id FROM users WHERE auth_id = auth.uid())));

-- Co-owners can also invite others (equal access)
CREATE POLICY "Co-owners can invite others"
  ON pet_co_owners FOR INSERT
  WITH CHECK (
    pet_id IN (
      SELECT pet_id FROM pet_co_owners
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND status = 'accepted'
    )
  );

-- Users can update their own co-owner status (accept/decline)
CREATE POLICY "Users can update own co-owner status"
  ON pet_co_owners FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Pet owners can delete co-owner records
CREATE POLICY "Pet owners can remove co-owners"
  ON pet_co_owners FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = (SELECT id FROM users WHERE auth_id = auth.uid())));

-- Admins can do everything
CREATE POLICY "Admins full access to pet_co_owners"
  ON pet_co_owners FOR ALL
  USING ((SELECT role FROM users WHERE auth_id = auth.uid()) = 'admin');
