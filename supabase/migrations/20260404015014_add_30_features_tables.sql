
-- 1. Pet vitals log (weight over time, temperature, etc.)
CREATE TABLE IF NOT EXISTS pet_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  weight TEXT,
  temperature TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pet_vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_vitals_access" ON pet_vitals FOR ALL USING (
  EXISTS (SELECT 1 FROM pets p JOIN cases c ON c.pet_id = p.id WHERE p.id = pet_vitals.pet_id AND (p.owner_id = auth.uid() OR c.assigned_buddy_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','practice_manager'))))
);

-- 2. Pet medications
CREATE TABLE IF NOT EXISTS pet_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pet_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_medications_access" ON pet_medications FOR ALL USING (
  EXISTS (SELECT 1 FROM pets p JOIN cases c ON c.pet_id = p.id WHERE p.id = pet_medications.pet_id AND (p.owner_id = auth.uid() OR c.assigned_buddy_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','practice_manager','external_vet'))))
);

-- 3. Pet vaccines
CREATE TABLE IF NOT EXISTS pet_vaccines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  administered_date DATE,
  due_date DATE,
  notes TEXT,
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pet_vaccines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_vaccines_access" ON pet_vaccines FOR ALL USING (
  EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_vaccines.pet_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM cases c WHERE c.pet_id = p.id AND c.assigned_buddy_id = auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','practice_manager','external_vet'))))
);

-- 4. Internal case notes (staff only)
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_notes_staff_only" ON case_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','vet_buddy','practice_manager','external_vet'))
);

-- 5. Canned responses (staff message shortcuts)
CREATE TABLE IF NOT EXISTS canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canned_responses_staff" ON canned_responses FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','vet_buddy','practice_manager'))
);

-- 6. Touchpoint templates
CREATE TABLE IF NOT EXISTS touchpoint_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'buddy',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE touchpoint_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "touchpoint_templates_staff" ON touchpoint_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','vet_buddy','practice_manager'))
);

-- 7. Buddy availability / out-of-office
CREATE TABLE IF NOT EXISTS buddy_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE buddy_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buddy_availability_access" ON buddy_availability FOR ALL USING (
  buddy_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','practice_manager'))
);

-- 8. Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id),
  referred_email TEXT,
  referred_user_id UUID REFERENCES users(id),
  stripe_coupon_id TEXT,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON referrals FOR ALL USING (
  referrer_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','practice_manager'))
);

-- 9. Add columns to existing tables
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read_by_client BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_type TEXT DEFAULT 'client';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'message';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS handoff_note TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS last_client_message_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_override TEXT;

-- 10. Seed some default touchpoint templates
INSERT INTO touchpoint_templates (name, content, type) VALUES
  ('30-Day Nutrition Check', 'Hi [Pet Name]''s family! Just checking in on how the nutrition plan is going at the 30-day mark. Have you noticed any changes in energy levels or coat condition? Any digestive changes to report?', 'buddy'),
  ('Post-Surgery Follow-Up', 'Hi! Following up after the recent procedure. How is [Pet Name] recovering? Are they eating and drinking normally? Any redness, swelling, or discharge at the incision site?', 'buddy'),
  ('Monthly Weight Check', 'Time for [Pet Name]''s monthly weigh-in! Please hop on a scale together and subtract your weight to get their weight, then share it here. We''ll track their progress toward the goal weight.', 'buddy'),
  ('Annual Wellness Reminder', 'Hi! [Pet Name]''s annual wellness check is coming up. We recommend scheduling with your local vet for a full exam, bloodwork, and vaccine updates. Let us know once that''s booked!', 'dvm'),
  ('Medication Compliance Check', 'Just a quick check-in — how is [Pet Name] tolerating the current medications? Any issues with giving them? Sometimes tricks like pill pockets or crushing into food can help.', 'buddy')
ON CONFLICT DO NOTHING;

-- 11. Seed some default canned responses
INSERT INTO canned_responses (shortcut, content) VALUES
  ('/thanks', 'Thank you for reaching out! We''ll review this and get back to you within 24 hours.'),
  ('/vet', 'For urgent medical concerns, please contact your local veterinarian or emergency animal hospital immediately.'),
  ('/schedule', 'I''d love to schedule a video call to discuss this further. Would any of these times work for you?'),
  ('/followup', 'Great update! I''ll make a note of this in [Pet Name]''s care plan and we''ll follow up at the next check-in.'),
  ('/welcome', 'Welcome to Vet Buddies! I''m so excited to be working with you and [Pet Name]. Let''s start by reviewing the care plan together.')
ON CONFLICT DO NOTHING;
