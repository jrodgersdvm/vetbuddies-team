
-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'practice_manager'))
);
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- CLIENT SURVEYS (CSAT)
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES public.cases(id),
  client_id uuid REFERENCES public.users(id),
  buddy_id uuid REFERENCES public.users(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  survey_type text DEFAULT 'csat',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.client_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can insert own surveys" ON public.client_surveys FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients can read own surveys" ON public.client_surveys FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Staff can read all surveys" ON public.client_surveys FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'vet_buddy', 'practice_manager'))
);

-- ============================================
-- FAQ / KNOWLEDGE BASE
-- ============================================
CREATE TABLE IF NOT EXISTS public.faq_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  sort_order integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.faq_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read published FAQs" ON public.faq_articles FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage FAQs" ON public.faq_articles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- HANDOFF NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS public.handoff_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES public.cases(id),
  from_buddy_id uuid REFERENCES public.users(id),
  to_buddy_id uuid REFERENCES public.users(id),
  active_issues text,
  watch_items text,
  client_preferences text,
  additional_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.handoff_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage handoff notes" ON public.handoff_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'vet_buddy', 'practice_manager'))
);

-- ============================================
-- REFERRAL TRACKING (enhance existing referrals table)
-- ============================================
-- Add columns to existing referrals table if they don't exist
DO $$ BEGIN
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_status text DEFAULT 'pending';
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_amount numeric DEFAULT 0;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_user_id uuid REFERENCES public.users(id);
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS converted_at timestamptz;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- ADD COLUMNS TO EXISTING TABLES
-- ============================================
-- Users: dark mode preference and 2FA
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_secret text;

-- Pet medications: refill tracking
ALTER TABLE public.pet_medications ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE public.pet_medications ADD COLUMN IF NOT EXISTS refill_date date;
ALTER TABLE public.pet_medications ADD COLUMN IF NOT EXISTS refill_reminded boolean DEFAULT false;

-- Appointments: calendar sync
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS ics_generated boolean DEFAULT false;

-- Seed some FAQ articles
INSERT INTO public.faq_articles (title, content, category, sort_order) VALUES
  ('What is care coordination?', 'Care coordination through Vet Buddies means you get a dedicated trained veterinary professional — your Buddy — who serves as your ongoing point of contact between vet visits. They help you track your pet''s health, answer day-to-day questions, and ensure nothing falls through the cracks.', 'getting-started', 1),
  ('What can my Buddy help with?', 'Your Buddy can help with wellness check-ins, tracking medications and vaccines, answering general care questions, coordinating with your vet, and keeping your pet''s Living Care Plan up to date. They cannot diagnose conditions or prescribe medications — that''s what Dr. Rodgers and your local vet are for.', 'getting-started', 2),
  ('When should I escalate to the Supervising DVM?', 'If your pet shows signs of an emergency (difficulty breathing, seizures, collapse, severe bleeding), go to your nearest emergency vet immediately. For non-emergency clinical questions, your Buddy can escalate to Dr. Rodgers for review within 24 hours.', 'care', 3),
  ('How do I update my pet''s information?', 'Navigate to your pet''s case, then click the pencil icon next to their name to edit details like weight, breed, or notes. You can also update their photo by clicking the camera icon.', 'using-the-portal', 4),
  ('What is the Living Care Plan?', 'The Living Care Plan is a dynamic document that tracks your pet''s complete health picture. It includes their profile, care team, active goals, engagement history, and milestones. Both you and your Buddy contribute to keeping it current.', 'care', 5),
  ('How do subscription tiers work?', 'We offer three tiers: Buddy ($99/mo) for monthly check-ins and messaging, Buddy+ ($149/mo) for weekly check-ins and priority access, and Buddy VIP ($279/mo) for unlimited check-ins and comprehensive care coordination.', 'billing', 6),
  ('Can I cancel my subscription?', 'Yes, you can cancel anytime from your subscription settings. Your access continues through the end of your current billing period.', 'billing', 7),
  ('How do I message my Buddy?', 'Open your pet''s case and click the Messages tab. Type your message and hit send. You can also mark messages as urgent if your pet needs prompt attention.', 'using-the-portal', 8)
ON CONFLICT DO NOTHING;
