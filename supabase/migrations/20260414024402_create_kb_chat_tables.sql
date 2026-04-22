
-- Conversations table
CREATE TABLE kb_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE kb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES kb_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_kb_conversations_user_id ON kb_conversations(user_id);
CREATE INDEX idx_kb_messages_conversation_id ON kb_messages(conversation_id);

-- RLS
ALTER TABLE kb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own conversations, admins can see all
CREATE POLICY "Users see own conversations" ON kb_conversations
  FOR SELECT USING (
    auth.uid() IN (SELECT auth_id FROM users WHERE id = kb_conversations.user_id)
    OR auth.uid() IN (SELECT auth_id FROM users WHERE role = 'admin')
  );

CREATE POLICY "Users insert own conversations" ON kb_conversations
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT auth_id FROM users WHERE id = kb_conversations.user_id)
  );

CREATE POLICY "Users update own conversations" ON kb_conversations
  FOR UPDATE USING (
    auth.uid() IN (SELECT auth_id FROM users WHERE id = kb_conversations.user_id)
  );

-- Messages: accessible if user owns the conversation or is admin
CREATE POLICY "Users see own messages" ON kb_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM kb_conversations WHERE
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Users insert own messages" ON kb_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM kb_conversations WHERE
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Service role bypass for edge function
CREATE POLICY "Service role full access conversations" ON kb_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access messages" ON kb_messages
  FOR ALL USING (auth.role() = 'service_role');
