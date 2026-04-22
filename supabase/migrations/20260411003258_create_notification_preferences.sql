
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_messages boolean NOT NULL DEFAULT true,
  email_escalations boolean NOT NULL DEFAULT true,
  weekly_digest boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
