ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_start text,
  ADD COLUMN IF NOT EXISTS quiet_hours_end text;
