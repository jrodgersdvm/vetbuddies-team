
-- Drop the client insert policy that causes recursion
DROP POLICY "Clients can insert cases for their own pets" ON cases;

-- Recreate it using get_my_pet_ids() which avoids triggering pets RLS
CREATE POLICY "Clients can insert cases for their own pets"
  ON cases FOR INSERT
  WITH CHECK (pet_id = ANY (get_my_pet_ids()));

-- Fix the geneticist pets policy to avoid querying cases through RLS
-- by using a SECURITY DEFINER function instead
CREATE OR REPLACE FUNCTION get_geneticist_pet_ids(gid uuid)
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT array_agg(c.pet_id)
  FROM cases c
  JOIN geneticist_case_access gca ON gca.case_id = c.id
  WHERE gca.geneticist_id = gid;
$$;

DROP POLICY "Geneticist read assigned pets" ON pets;

CREATE POLICY "Geneticist read assigned pets"
  ON pets FOR SELECT
  USING (
    get_my_role() = 'geneticist'
    AND id = ANY (get_geneticist_pet_ids(get_my_user_id()))
  );
