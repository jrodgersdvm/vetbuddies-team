
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_tier_stripe text;

COMMENT ON COLUMN public.users.stripe_customer_id     IS 'Stripe customer ID (cus_...)';
COMMENT ON COLUMN public.users.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.users.subscription_status    IS 'Stripe subscription status: none | active | past_due | canceled | trialing';
COMMENT ON COLUMN public.users.subscription_tier_stripe IS 'Stripe price ID for current subscription';
