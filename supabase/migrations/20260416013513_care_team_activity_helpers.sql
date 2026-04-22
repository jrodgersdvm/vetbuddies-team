
-- Helper function to increment assists_given for a user
-- Called from client-side when a care team member performs a care action
CREATE OR REPLACE FUNCTION public.increment_assists_given(uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_care_stats (user_id, assists_given, updated_at)
  VALUES (uid, 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET assists_given = user_care_stats.assists_given + 1,
      updated_at = now();
END;
$$;
