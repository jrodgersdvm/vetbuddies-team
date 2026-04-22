
-- Fix pet_badges: uses old role names 'buddy'/'dvm' instead of 'vet_buddy'/'admin'
DROP POLICY IF EXISTS "owner access" ON public.pet_badges;
CREATE POLICY pet_badges_access ON public.pet_badges FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
  );

-- Fix pet_care_level: same old role names
DROP POLICY IF EXISTS "owner access" ON public.pet_care_level;
CREATE POLICY pet_care_level_access ON public.pet_care_level FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = public.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = public.current_user_id())
    OR public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy')
  );

-- Fix user_badges: old role names 'buddy'/'dvm'
DROP POLICY IF EXISTS "users read own badges" ON public.user_badges;
CREATE POLICY user_badges_access ON public.user_badges FOR ALL
  USING (
    user_id = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    user_id = public.current_user_id()
  );

-- Fix user_care_stats: old role names 'buddy'/'dvm'
DROP POLICY IF EXISTS "users read own stats" ON public.user_care_stats;
CREATE POLICY user_care_stats_access ON public.user_care_stats FOR ALL
  USING (
    user_id = public.current_user_id()
    OR public.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    user_id = public.current_user_id()
  );
