
-- Add missing columns that the portal code expects
ALTER TABLE public.pending_invites
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS message text;
