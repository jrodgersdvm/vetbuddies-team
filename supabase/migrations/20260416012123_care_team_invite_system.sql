
-- ============================================================
-- Phase 1: Care Team Invite System
-- Connects pending_invites -> referrals -> user_care_stats -> XP/badges
-- Idempotent: safe to re-run
-- ============================================================

-- 1. Add invite_source column to pending_invites
ALTER TABLE public.pending_invites
  ADD COLUMN IF NOT EXISTS invite_source TEXT NOT NULL DEFAULT 'direct';

-- 2. Unique index on referrals(referred_email) for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_email_key
  ON public.referrals (referred_email);

-- 3. Unique index on user_badges(user_id, badge_type) for idempotent badge awarding
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_id_badge_type_key
  ON public.user_badges (user_id, badge_type);

-- 4. Main function: handle_care_team_invite_accepted
CREATE OR REPLACE FUNCTION public.handle_care_team_invite_accepted(
  invite_token TEXT,
  new_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_pet_id UUID;
  v_member_count INT;
BEGIN
  -- (a) Look up the pending invite by token
  SELECT * INTO v_invite
  FROM public.pending_invites
  WHERE token = invite_token;

  -- If not found or already used, return early
  IF NOT FOUND OR v_invite.used_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- (b) Grant case access to the new user
  INSERT INTO public.case_access (case_id, user_id, granted_by, role, display_name)
  VALUES (
    v_invite.case_id,
    new_user_id,
    v_invite.invited_by,
    v_invite.role,
    COALESCE(v_invite.first_name, '') || ' ' || COALESCE(v_invite.last_name, '')
  )
  ON CONFLICT (case_id, user_id) DO NOTHING;

  -- (c) Mark invite as used
  UPDATE public.pending_invites
  SET used_at = now()
  WHERE id = v_invite.id;

  -- (d) If this was a care_team invite, create a referral
  IF v_invite.invite_source = 'care_team' THEN
    INSERT INTO public.referrals (referrer_id, referred_email, referred_user_id, reward_status, created_at)
    VALUES (v_invite.invited_by, v_invite.email, new_user_id, 'pending', now())
    ON CONFLICT (referred_email) DO NOTHING;
  END IF;

  -- (e) Award XP to the pet (get pet_id from cases)
  SELECT pet_id INTO v_pet_id
  FROM public.cases
  WHERE id = v_invite.case_id;

  IF v_pet_id IS NOT NULL THEN
    PERFORM public.award_xp(v_pet_id, 25, 'Care team member joined');
  END IF;

  -- (f) Upsert user_care_stats for the inviter: increment teams_built
  INSERT INTO public.user_care_stats (user_id, teams_built, updated_at)
  VALUES (v_invite.invited_by, 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET teams_built = user_care_stats.teams_built + 1,
      updated_at = now();

  -- (g) Upsert user_care_stats for the new user: increment teams_joined
  INSERT INTO public.user_care_stats (user_id, teams_joined, updated_at)
  VALUES (new_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET teams_joined = user_care_stats.teams_joined + 1,
      updated_at = now();

  -- (h) Check milestone badges for the inviter
  SELECT COUNT(*) INTO v_member_count
  FROM public.case_access
  WHERE granted_by = v_invite.invited_by
    AND role NOT IN ('buddy', 'dvm', 'admin');

  IF v_member_count >= 5 THEN
    PERFORM public.award_user_badge(v_invite.invited_by, 'team_builder_5', 'Full Care Team');
  END IF;
  IF v_member_count >= 3 THEN
    PERFORM public.award_user_badge(v_invite.invited_by, 'team_builder_3', 'Care Team Growing');
  END IF;
  IF v_member_count >= 1 THEN
    PERFORM public.award_user_badge(v_invite.invited_by, 'team_builder_1', 'Care Team Started');
  END IF;

END;
$$;
