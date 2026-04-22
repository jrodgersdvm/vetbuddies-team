CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = get_my_user_id());

-- Service role (edge functions) can read all subscriptions
CREATE POLICY "Service role reads all push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'service_role');
