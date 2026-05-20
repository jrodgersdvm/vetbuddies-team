-- Reliable detection of whether the currently-authenticated user has a
-- password set. Reading auth.users.identities[].identity_data.hashed_password
-- from the client is unreliable — for older accounts the identity_data row
-- does not include that field even when encrypted_password is set, causing
-- the "Set a password" modal to false-positive on every login.
CREATE OR REPLACE FUNCTION public.current_user_has_password()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT encrypted_password IS NOT NULL
  FROM auth.users
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;
