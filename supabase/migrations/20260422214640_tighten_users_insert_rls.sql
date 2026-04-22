-- Restrict users INSERT to authenticated role and require auth_id = auth.uid().
-- Previously "Anyone can insert users" had WITH CHECK (true) for role {public},
-- which let any anon caller create rows with arbitrary auth_id values.
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;

CREATE POLICY "Authenticated users insert own row" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());
