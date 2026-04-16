-- ============================================
-- Row Level Security (RLS) Policies for VetBuddies
-- ============================================
-- Run this migration in the Supabase SQL Editor.
-- This enables RLS on all tables and creates policies
-- so users can only access data they are authorized for.
--
-- Roles:
--   client        — pet owner
--   vet_buddy     — assigned veterinary student
--   admin         — supervising DVM / practice manager
--   practice_manager — admin-lite
--   external_vet  — partner veterinarian
--   geneticist    — genetic consultant

-- Helper: get current user's internal profile id and role
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS uuid AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.current_user_role() RETURNS text AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ════════════════════════════════════════════
-- USERS
-- ════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY users_select_own ON users FOR SELECT
  USING (auth_id = auth.uid());

-- Admins can read all users
CREATE POLICY users_select_admin ON users FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));

-- Vet buddies can read clients assigned to them (via cases)
CREATE POLICY users_select_buddy ON users FOR SELECT
  USING (
    auth.current_user_role() = 'vet_buddy'
    AND id IN (
      SELECT c.pet_id FROM cases c
      JOIN pets p ON p.id = c.pet_id
      WHERE c.assigned_buddy_id = auth.current_user_id()
      UNION
      SELECT p.owner_id FROM cases c
      JOIN pets p ON p.id = c.pet_id
      WHERE c.assigned_buddy_id = auth.current_user_id()
    )
  );

-- Users can update their own profile
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Admins can update any user
CREATE POLICY users_update_admin ON users FOR UPDATE
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));

-- Users can insert their own record (signup)
CREATE POLICY users_insert_own ON users FOR INSERT
  WITH CHECK (auth_id = auth.uid());


-- ════════════════════════════════════════════
-- PETS
-- ════════════════════════════════════════════
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Owner can CRUD their own pets
CREATE POLICY pets_owner ON pets FOR ALL
  USING (owner_id = auth.current_user_id())
  WITH CHECK (owner_id = auth.current_user_id());

-- Co-owners can read pets they co-own
CREATE POLICY pets_coowner ON pets FOR SELECT
  USING (
    id IN (SELECT pet_id FROM pet_co_owners WHERE user_id = auth.current_user_id() AND status = 'accepted')
  );

-- Staff can read all pets
CREATE POLICY pets_staff ON pets FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy', 'external_vet', 'geneticist'));

-- Admins can update any pet
CREATE POLICY pets_admin_update ON pets FOR UPDATE
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- CASES
-- ════════════════════════════════════════════
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Client: read cases for their own pets
CREATE POLICY cases_client ON cases FOR SELECT
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT pet_id FROM pet_co_owners WHERE user_id = auth.current_user_id() AND status = 'accepted')
  );

-- Buddy: read cases assigned to them
CREATE POLICY cases_buddy ON cases FOR SELECT
  USING (assigned_buddy_id = auth.current_user_id());

-- Admin: read all cases
CREATE POLICY cases_admin ON cases FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));

-- External vet / geneticist: read cases they have access to
CREATE POLICY cases_external ON cases FOR SELECT
  USING (
    id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
  );

-- Admin can insert/update any case
CREATE POLICY cases_admin_write ON cases FOR ALL
  USING (auth.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (auth.current_user_role() IN ('admin', 'practice_manager'));

-- Client can insert cases for their own pets
CREATE POLICY cases_client_insert ON cases FOR INSERT
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
  );


-- ════════════════════════════════════════════
-- CARE_PLANS
-- ════════════════════════════════════════════
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;

-- Readable by anyone with case access
CREATE POLICY care_plans_read ON care_plans FOR SELECT
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

-- Writable by staff and owner
CREATE POLICY care_plans_write ON care_plans FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- MESSAGES
-- ════════════════════════════════════════════
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Anyone with case access can read messages for that case
CREATE POLICY messages_read ON messages FOR SELECT
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

-- Anyone with case access can send messages
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.current_user_id()
    AND (
      case_id IN (
        SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
        WHERE p.owner_id = auth.current_user_id()
           OR c.assigned_buddy_id = auth.current_user_id()
      )
      OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
      OR auth.current_user_role() IN ('admin', 'practice_manager')
    )
  );

-- Staff can update read status on messages
CREATE POLICY messages_update ON messages FOR UPDATE
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- CASE_DOCUMENTS
-- ════════════════════════════════════════════
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_documents_access ON case_documents FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- TIMELINE_ENTRIES
-- ════════════════════════════════════════════
ALTER TABLE timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY timeline_entries_access ON timeline_entries FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    author_id = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- PET_VITALS, PET_MEDICATIONS, PET_VACCINES
-- ════════════════════════════════════════════
ALTER TABLE pet_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_vaccines ENABLE ROW LEVEL SECURITY;

-- Shared pattern: pet owner, assigned buddy, or admin
CREATE POLICY pet_vitals_access ON pet_vitals FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

CREATE POLICY pet_medications_access ON pet_medications FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

CREATE POLICY pet_vaccines_access ON pet_vaccines FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- PET_CARE_LEVEL, PET_BADGES
-- ════════════════════════════════════════════
ALTER TABLE pet_care_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_care_level_access ON pet_care_level FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

CREATE POLICY pet_badges_access ON pet_badges FOR ALL
  USING (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR pet_id IN (SELECT c.pet_id FROM cases c WHERE c.assigned_buddy_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- USER_CARE_STATS, USER_BADGES
-- ════════════════════════════════════════════
ALTER TABLE user_care_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_care_stats_own ON user_care_stats FOR ALL
  USING (user_id = auth.current_user_id())
  WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY user_care_stats_admin ON user_care_stats FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));

CREATE POLICY user_badges_own ON user_badges FOR ALL
  USING (user_id = auth.current_user_id())
  WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY user_badges_admin ON user_badges FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- TOUCHPOINTS, APPOINTMENTS
-- ════════════════════════════════════════════
ALTER TABLE touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY touchpoints_access ON touchpoints FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

CREATE POLICY appointments_access ON appointments FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- CASE_NOTES
-- ════════════════════════════════════════════
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_notes_access ON case_notes FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    created_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- CASE_ACCESS
-- ════════════════════════════════════════════
ALTER TABLE case_access ENABLE ROW LEVEL SECURITY;

-- Users can see their own access grants
CREATE POLICY case_access_own ON case_access FOR SELECT
  USING (user_id = auth.current_user_id());

-- Admin can manage all access
CREATE POLICY case_access_admin ON case_access FOR ALL
  USING (auth.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- ESCALATIONS
-- ════════════════════════════════════════════
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Staff can read all escalations
CREATE POLICY escalations_staff ON escalations FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy'));

-- Anyone on the case can create escalations
CREATE POLICY escalations_insert ON escalations FOR INSERT
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

-- Admin can update escalation status
CREATE POLICY escalations_update ON escalations FOR UPDATE
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- PET_CO_OWNERS, PENDING_INVITES
-- ════════════════════════════════════════════
ALTER TABLE pet_co_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_co_owners_own ON pet_co_owners FOR ALL
  USING (
    user_id = auth.current_user_id()
    OR invited_by = auth.current_user_id()
    OR pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    invited_by = auth.current_user_id()
    OR pet_id IN (SELECT id FROM pets WHERE owner_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

CREATE POLICY pending_invites_access ON pending_invites FOR ALL
  USING (
    invited_by = auth.current_user_id()
    OR email = (SELECT email FROM users WHERE auth_id = auth.uid())
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    invited_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- NOTIFICATION_PREFERENCES, PUSH_SUBSCRIPTIONS
-- ════════════════════════════════════════════
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_own ON notification_preferences FOR ALL
  USING (user_id = auth.current_user_id())
  WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY push_subs_own ON push_subscriptions FOR ALL
  USING (user_id = auth.current_user_id())
  WITH CHECK (user_id = auth.current_user_id());


-- ════════════════════════════════════════════
-- CARE_REQUESTS
-- ════════════════════════════════════════════
ALTER TABLE care_requests ENABLE ROW LEVEL SECURITY;

-- Open requests visible to all authenticated users (community feature)
CREATE POLICY care_requests_read ON care_requests FOR SELECT
  USING (
    status = 'open'
    OR owner_id = auth.current_user_id()
    OR claimed_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );

-- Owner can create requests for their pets
CREATE POLICY care_requests_insert ON care_requests FOR INSERT
  WITH CHECK (owner_id = auth.current_user_id());

-- Owner or claimer can update requests
CREATE POLICY care_requests_update ON care_requests FOR UPDATE
  USING (
    owner_id = auth.current_user_id()
    OR claimed_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  );


-- ════════════════════════════════════════════
-- KB_CONVERSATIONS, KB_MESSAGES
-- ════════════════════════════════════════════
ALTER TABLE kb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_conversations_own ON kb_conversations FOR ALL
  USING (user_id = auth.current_user_id())
  WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY kb_conversations_admin ON kb_conversations FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));

CREATE POLICY kb_messages_own ON kb_messages FOR ALL
  USING (
    conversation_id IN (SELECT id FROM kb_conversations WHERE user_id = auth.current_user_id())
  )
  WITH CHECK (
    conversation_id IN (SELECT id FROM kb_conversations WHERE user_id = auth.current_user_id())
  );

CREATE POLICY kb_messages_admin ON kb_messages FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- FAQ_ARTICLES (public read, admin write)
-- ════════════════════════════════════════════
ALTER TABLE faq_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY faq_articles_read ON faq_articles FOR SELECT
  USING (is_published = true OR auth.current_user_role() IN ('admin', 'practice_manager'));

CREATE POLICY faq_articles_admin ON faq_articles FOR ALL
  USING (auth.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- ADMIN_RESOURCES
-- ════════════════════════════════════════════
ALTER TABLE admin_resources ENABLE ROW LEVEL SECURITY;

-- Staff can read resources
CREATE POLICY admin_resources_staff ON admin_resources FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy'));

-- Admin can manage resources
CREATE POLICY admin_resources_admin ON admin_resources FOR ALL
  USING (auth.current_user_role() IN ('admin', 'practice_manager'))
  WITH CHECK (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- CLIENT_SURVEYS
-- ════════════════════════════════════════════
ALTER TABLE client_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_surveys_own ON client_surveys FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
    )
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
    )
  );

CREATE POLICY client_surveys_staff ON client_surveys FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager', 'vet_buddy'));


-- ════════════════════════════════════════════
-- GENETIC_INSIGHTS
-- ════════════════════════════════════════════
ALTER TABLE genetic_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY genetic_insights_access ON genetic_insights FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM cases c JOIN pets p ON p.id = c.pet_id
      WHERE p.owner_id = auth.current_user_id()
         OR c.assigned_buddy_id = auth.current_user_id()
    )
    OR case_id IN (SELECT case_id FROM case_access WHERE user_id = auth.current_user_id())
    OR auth.current_user_role() IN ('admin', 'practice_manager', 'geneticist')
  )
  WITH CHECK (
    auth.current_user_role() IN ('admin', 'practice_manager', 'geneticist')
  );


-- ════════════════════════════════════════════
-- CANNED_RESPONSES, TOUCHPOINT_TEMPLATES
-- ════════════════════════════════════════════
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE touchpoint_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY canned_responses_own ON canned_responses FOR ALL
  USING (
    created_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (created_by = auth.current_user_id());

CREATE POLICY touchpoint_templates_own ON touchpoint_templates FOR ALL
  USING (
    created_by = auth.current_user_id()
    OR auth.current_user_role() IN ('admin', 'practice_manager')
  )
  WITH CHECK (created_by = auth.current_user_id());


-- ════════════════════════════════════════════
-- BUDDY_AVAILABILITY
-- ════════════════════════════════════════════
ALTER TABLE buddy_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY buddy_availability_own ON buddy_availability FOR ALL
  USING (buddy_id = auth.current_user_id())
  WITH CHECK (buddy_id = auth.current_user_id());

CREATE POLICY buddy_availability_admin ON buddy_availability FOR SELECT
  USING (auth.current_user_role() IN ('admin', 'practice_manager'));


-- ════════════════════════════════════════════
-- AUDIT_LOG (admin read-only, insert by anyone)
-- ════════════════════════════════════════════
-- Note: If audit_log table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    EXECUTE 'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (user_id = auth.current_user_id())';
    EXECUTE 'CREATE POLICY audit_log_admin ON audit_log FOR SELECT USING (auth.current_user_role() IN (''admin'', ''practice_manager''))';
  END IF;
END $$;
