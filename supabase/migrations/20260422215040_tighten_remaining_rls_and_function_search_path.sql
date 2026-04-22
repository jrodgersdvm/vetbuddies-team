-- =========================================================
-- 1. audit_log INSERT: restrict to writing under own user_id
-- =========================================================
-- Previously WITH CHECK (true) let any authenticated user write audit rows
-- with an arbitrary user_id. Client code always inserts with state.profile.id,
-- so tightening to current_user_id() is safe. NULL user_id stays allowed for
-- service-role-inserted system events (service_role bypasses RLS anyway).
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;

CREATE POLICY "Authenticated users insert own audit rows" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = public.current_user_id());


-- =========================================================
-- 2. notification_log INSERT: drop overly-permissive policy
-- =========================================================
-- Previously WITH CHECK (true) for role {public} (includes anon). No client
-- code inserts into this table — only edge functions do, and they use
-- service_role which bypasses RLS. Dropping the policy closes the anon hole
-- without breaking anything.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notification_log;


-- =========================================================
-- 3. Pin search_path on all flagged SECURITY DEFINER functions
-- =========================================================
-- A mutable search_path on a SECURITY DEFINER function is a privilege-escalation
-- footgun: a caller with CREATE on a schema earlier in their search_path could
-- shadow a real object with a malicious one. Pin to `public, pg_temp`.
ALTER FUNCTION public.build_escalation_context(uuid)             SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_lcp_completeness(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access_care_plan(uuid)                 SET search_path = public, pg_temp;
ALTER FUNCTION public.create_case_for_new_pet()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_id()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_role()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_geneticist_pet_ids(uuid)               SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_role()                              SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_user_id()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_dvm_clinical_notes()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_dvm_response()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_care_team_invite_accepted(text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_referral_conversion()               SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_assists_given(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_lcp_completeness()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at()                        SET search_path = public, pg_temp;
