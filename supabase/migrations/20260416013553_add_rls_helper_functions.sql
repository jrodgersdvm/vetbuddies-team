
-- Helper functions for RLS policies
-- Returns the internal user id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns the role for the currently authenticated user
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
