
-- Fix 'dvm' role references in staff policies — replace with correct role names

-- users
DROP POLICY IF EXISTS "Staff read all users" ON public.users;
CREATE POLICY "Staff read all users" ON public.users FOR SELECT
  USING (get_my_role_safe() IN ('admin', 'vet_buddy', 'external_vet', 'geneticist', 'practice_manager'));

-- pets
DROP POLICY IF EXISTS "Staff see all pets" ON public.pets;
CREATE POLICY "Staff see all pets" ON public.pets FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager', 'external_vet'));

-- cases
DROP POLICY IF EXISTS "Staff see all cases" ON public.cases;
CREATE POLICY "Staff see all cases" ON public.cases FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager'));

-- care_plans
DROP POLICY IF EXISTS "Staff see care plans" ON public.care_plans;
CREATE POLICY "Staff see care plans" ON public.care_plans FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager', 'external_vet'));

-- messages (SELECT)
DROP POLICY IF EXISTS "Case participants see messages" ON public.messages;
CREATE POLICY "Case participants see messages" ON public.messages FOR SELECT
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager') OR case_id = ANY (get_my_case_ids()));

-- messages (UPDATE)
DROP POLICY IF EXISTS "Participants update messages" ON public.messages;
CREATE POLICY "Participants update messages" ON public.messages FOR UPDATE
  USING (get_my_role() IN ('admin', 'vet_buddy', 'practice_manager') OR case_id = ANY (get_my_case_ids()));
