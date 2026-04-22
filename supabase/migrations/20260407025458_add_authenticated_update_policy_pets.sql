
-- Add explicit UPDATE policy for authenticated role on pets table
-- Covers both staff (admin/vet_buddy) and clients updating their own pets
CREATE POLICY "Authenticated staff update pets"
ON public.pets
FOR UPDATE
TO authenticated
USING (get_my_role() = ANY (ARRAY['admin'::text, 'vet_buddy'::text]));

CREATE POLICY "Clients can update own pets"
ON public.pets
FOR UPDATE
TO authenticated
USING (owner_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
