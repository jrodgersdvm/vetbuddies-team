
-- Fix referrals: referrer_id = auth.uid() and u.id = auth.uid() are wrong
DROP POLICY IF EXISTS referrals_own ON public.referrals;
CREATE POLICY referrals_own ON public.referrals FOR ALL
  USING (
    referrer_id = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    referrer_id = public.current_user_id()
  );

-- Fix pet_medications: owner_id = auth.uid() and u.id = auth.uid() are wrong
DROP POLICY IF EXISTS pet_medications_access ON public.pet_medications;
CREATE POLICY pet_medications_access ON public.pet_medications FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'external_vet')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );

-- Fix pet_vaccines: same issue
DROP POLICY IF EXISTS pet_vaccines_access ON public.pet_vaccines;
CREATE POLICY pet_vaccines_access ON public.pet_vaccines FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'external_vet')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );

-- Fix pet_vitals: same issue
DROP POLICY IF EXISTS pet_vitals_access ON public.pet_vitals;
CREATE POLICY pet_vitals_access ON public.pet_vitals FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager')
  );
