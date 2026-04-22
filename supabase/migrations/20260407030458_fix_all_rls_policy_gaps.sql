
-- 1. MESSAGES: Add UPDATE policy so mark-as-read works
CREATE POLICY "Participants update messages"
ON public.messages FOR UPDATE TO authenticated
USING (true);

-- 2. PENDING_INVITES: Add full CRUD for staff
CREATE POLICY "Staff manage invites"
ON public.pending_invites FOR ALL TO authenticated
USING (get_my_role() = ANY (ARRAY['admin'::text, 'vet_buddy'::text]));

CREATE POLICY "Staff read invites"
ON public.pending_invites FOR SELECT TO authenticated
USING (get_my_role() = ANY (ARRAY['admin'::text, 'vet_buddy'::text, 'dvm'::text]));

-- 3. CARE_PLANS: Add INSERT for clients (onboarding creates care plan)
CREATE POLICY "Clients can insert care plan"
ON public.care_plans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    JOIN pets ON pets.id = cases.pet_id
    WHERE cases.id = care_plans.case_id
    AND pets.owner_id = get_my_user_id()
  )
);

-- 4. TIMELINE_ENTRIES: Add INSERT for clients (system entries during onboarding)
CREATE POLICY "Clients insert timeline for own cases"
ON public.timeline_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    JOIN pets ON pets.id = cases.pet_id
    WHERE cases.id = timeline_entries.case_id
    AND pets.owner_id = get_my_user_id()
  )
);

-- 5. TOUCHPOINTS: Add UPDATE for clients (satisfaction rating)
CREATE POLICY "Clients rate touchpoints"
ON public.touchpoints FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cases
    JOIN pets ON pets.id = cases.pet_id
    WHERE cases.id = touchpoints.case_id
    AND pets.owner_id = get_my_user_id()
  )
);
