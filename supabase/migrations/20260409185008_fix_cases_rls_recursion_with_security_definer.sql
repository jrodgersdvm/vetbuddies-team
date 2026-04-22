
-- The recursion chain is:
-- cases RLS -> case_documents RLS -> cases (infinite loop)
-- and: cases RLS -> pets RLS -> cases (via geneticist policy)
--
-- Fix: rewrite the case_documents policy to NOT subquery cases
-- Instead check role directly without joining back to cases

DROP POLICY IF EXISTS "Users can view docs for their cases" ON case_documents;

-- New policy: admin/buddy/external_vet see all docs; clients see their own via a
-- SECURITY DEFINER function that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_my_case_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(c.id)
  FROM cases c
  JOIN pets p ON p.id = c.pet_id
  WHERE p.owner_id = (SELECT id FROM users WHERE auth_id = auth.uid())
$$;

-- Recreate case_documents SELECT policy using the helper function
CREATE POLICY "Users can view docs for their cases"
  ON case_documents FOR SELECT
  USING (
    -- Staff: check role directly, no cases join
    (EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = ANY(ARRAY['admin','vet_buddy','external_vet','dvm'])
    ))
    OR
    -- Clients: use security definer function to avoid recursion
    (case_documents.case_id = ANY(get_my_case_ids()))
  );
