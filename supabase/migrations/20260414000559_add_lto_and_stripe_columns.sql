-- Add LTO and Stripe columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS promotional_price numeric,
  ADD COLUMN IF NOT EXISTS promotional_label text,
  ADD COLUMN IF NOT EXISTS promotional_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Create the case-files storage bucket (public so edge function can fetch docs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;
