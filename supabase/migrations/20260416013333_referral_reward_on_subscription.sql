
-- ============================================================
-- Phase 4: Referral reward trigger on subscription conversion
-- When a referred user subscribes (subscription_status -> 'active'),
-- reward the referrer with $20 credit and community score.
-- Idempotent: safe to re-run
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_referral_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral RECORD;
  v_current_price NUMERIC;
BEGIN
  -- Only fire when subscription_status changes to 'active'
  IF NEW.subscription_status = 'active' AND (OLD.subscription_status IS DISTINCT FROM 'active') THEN

    -- Find pending referral for this user
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE referred_user_id = NEW.id
      AND reward_status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      -- Mark the referral as rewarded
      UPDATE public.referrals
      SET reward_status = 'rewarded',
          reward_amount = 20.00,
          rewarded_at = now(),
          converted_at = now()
      WHERE id = v_referral.id;

      -- Apply promotional credit to the referrer if not already set
      UPDATE public.users
      SET promotional_price = GREATEST(0, COALESCE(
            (SELECT CASE subscription_tier_stripe
              WHEN 'buddy' THEN 59
              WHEN 'buddy_plus' THEN 99
              WHEN 'buddy_vip' THEN 149
              ELSE 59 END
            FROM public.users WHERE id = v_referral.referrer_id),
          59) - 20.00),
          promotional_label = 'Referral credit applied',
          promotional_locked_at = now()
      WHERE id = v_referral.referrer_id
        AND promotional_price IS NULL;

      -- Increment community_score for the referrer
      INSERT INTO public.user_care_stats (user_id, community_score, updated_at)
      VALUES (v_referral.referrer_id, 50, now())
      ON CONFLICT (user_id) DO UPDATE
      SET community_score = user_care_stats.community_score + 50,
          updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trg_referral_conversion ON public.users;
CREATE TRIGGER trg_referral_conversion
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.subscription_status = 'active')
  EXECUTE FUNCTION public.handle_referral_conversion();
