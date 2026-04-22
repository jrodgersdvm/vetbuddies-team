
-- The "Clients see own cases" policy queries pets
-- The "Geneticist read assigned pets" policy queries cases
-- This creates: cases -> pets -> cases recursion
-- Fix: rewrite "Clients see own cases" to use SECURITY DEFINER function

DROP POLICY IF EXISTS "Clients see own cases" ON cases;

-- Helper: get pet IDs owned by current user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_pet_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(id) FROM pets WHERE owner_id = (
    SELECT id FROM users WHERE auth_id = auth.uid()
  )
$$;

-- Recreate client cases policy using the helper (no pets RLS join)
CREATE POLICY "Clients see own cases"
  ON cases FOR SELECT
  USING (
    cases.pet_id = ANY(get_my_pet_ids())
  );

-- Also fix care_plans, touchpoints, timeline_entries, messages, appointments
-- that query cases->pets creating the same recursion chain
-- These are safe because they don't cause cases->X->cases recursion
-- since cases policy now uses security definer functions

-- Fix messages policy which also joins cases->pets
DROP POLICY IF EXISTS "Case participants see messages" ON messages;

CREATE POLICY "Case participants see messages"
  ON messages FOR SELECT
  USING (
    (get_my_role() = ANY (ARRAY['admin','vet_buddy','dvm']))
    OR
    (messages.case_id = ANY(get_my_case_ids()))
  );
