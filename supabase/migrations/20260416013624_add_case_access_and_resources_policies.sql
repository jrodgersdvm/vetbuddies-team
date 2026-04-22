
-- case_access: users can see their own access grants, admin can manage all
CREATE POLICY case_access_own ON public.case_access FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY case_access_admin ON public.case_access FOR ALL
  USING (public.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'practice_manager'));

-- resources: staff can read, admin can manage
CREATE POLICY resources_staff_read ON public.resources FOR SELECT
  USING (public.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy'));

CREATE POLICY resources_admin_write ON public.resources FOR ALL
  USING (public.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'practice_manager'));
