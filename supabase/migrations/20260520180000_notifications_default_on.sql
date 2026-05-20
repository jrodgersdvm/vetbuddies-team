-- Flip notification defaults so every new user gets push + email by default.
-- See docs/notifications-rework-prompt.md.
ALTER TABLE public.notification_preferences
  ALTER COLUMN push_enabled SET DEFAULT true;

-- Insert default rows for every existing user that doesn't have one.
-- (All 20 users were missing rows as of this migration.)
INSERT INTO public.notification_preferences (user_id, push_enabled, email_messages, email_escalations)
SELECT u.id, true, true, true
FROM public.users u
LEFT JOIN public.notification_preferences np ON np.user_id = u.id
WHERE np.user_id IS NULL
  AND u.role IN ('client', 'vet_buddy', 'admin', 'practice_manager');

-- For anyone who had a row with push_enabled=false but email_messages=true
-- (i.e. matched the OLD column defaults — passive, never explicitly opted out),
-- flip push on. Anyone who actively opted out of email_messages keeps push off.
UPDATE public.notification_preferences
  SET push_enabled = true
  WHERE push_enabled = false
    AND email_messages = true;
