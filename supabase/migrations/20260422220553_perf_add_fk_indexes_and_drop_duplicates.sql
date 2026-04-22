-- ===========================================================
-- Performance advisor fixes:
--   1. Add covering indexes for 58 foreign-key columns
--   2. Drop 2 duplicate unique constraints (each has an identical twin)
-- Tables are currently 0-30 rows each; blocking writes during
-- CREATE INDEX is a non-issue, so no need for CONCURRENTLY.
-- ===========================================================

-- Drop duplicate unique constraints (each has an identical *_key twin that remains)
ALTER TABLE public.care_plans DROP CONSTRAINT IF EXISTS care_plans_case_id_unique;
ALTER TABLE public.users      DROP CONSTRAINT IF EXISTS users_referral_code_unique;

-- Foreign-key indexes (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to              ON public.appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_case_id                  ON public.appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id                     ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_buddy_availability_buddy_id           ON public.buddy_availability(buddy_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by           ON public.canned_responses(created_by);
CREATE INDEX IF NOT EXISTS idx_care_plan_diagnoses_created_by        ON public.care_plan_diagnoses(created_by);
CREATE INDEX IF NOT EXISTS idx_care_plan_open_questions_created_by   ON public.care_plan_open_questions(created_by);
CREATE INDEX IF NOT EXISTS idx_care_plans_updated_by                 ON public.care_plans(updated_by);
CREATE INDEX IF NOT EXISTS idx_care_requests_claimed_by              ON public.care_requests(claimed_by);
CREATE INDEX IF NOT EXISTS idx_care_requests_owner_id                ON public.care_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_pet_id                  ON public.care_requests(pet_id);
CREATE INDEX IF NOT EXISTS idx_case_access_granted_by                ON public.case_access(granted_by);
CREATE INDEX IF NOT EXISTS idx_case_access_user_id                   ON public.case_access(user_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id                ON public.case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_by            ON public.case_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_id                    ON public.case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_created_by                 ON public.case_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_buddy_id               ON public.cases(assigned_buddy_id);
CREATE INDEX IF NOT EXISTS idx_cases_pet_id                          ON public.cases(pet_id);
CREATE INDEX IF NOT EXISTS idx_client_surveys_buddy_id               ON public.client_surveys(buddy_id);
CREATE INDEX IF NOT EXISTS idx_client_surveys_case_id                ON public.client_surveys(case_id);
CREATE INDEX IF NOT EXISTS idx_client_surveys_client_id              ON public.client_surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_escalations_acknowledged_by           ON public.escalations(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_escalations_case_id                   ON public.escalations(case_id);
CREATE INDEX IF NOT EXISTS idx_escalations_escalated_message_id      ON public.escalations(escalated_message_id);
CREATE INDEX IF NOT EXISTS idx_escalations_raised_by                 ON public.escalations(raised_by);
CREATE INDEX IF NOT EXISTS idx_escalations_resolved_by               ON public.escalations(resolved_by);
CREATE INDEX IF NOT EXISTS idx_faq_articles_created_by               ON public.faq_articles(created_by);
CREATE INDEX IF NOT EXISTS idx_genetic_insights_authored_by          ON public.genetic_insights(authored_by);
CREATE INDEX IF NOT EXISTS idx_genetic_insights_case_id              ON public.genetic_insights(case_id);
CREATE INDEX IF NOT EXISTS idx_geneticist_case_access_geneticist_id  ON public.geneticist_case_access(geneticist_id);
CREATE INDEX IF NOT EXISTS idx_geneticist_case_access_granted_by     ON public.geneticist_case_access(granted_by);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_case_id                 ON public.handoff_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_from_buddy_id           ON public.handoff_notes(from_buddy_id);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_to_buddy_id             ON public.handoff_notes(to_buddy_id);
CREATE INDEX IF NOT EXISTS idx_messages_case_id                      ON public.messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id                    ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_case_id              ON public.notification_log(case_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_message_id           ON public.notification_log(message_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_case_id               ON public.pending_invites(case_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_invited_by            ON public.pending_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_pet_badges_pet_id                     ON public.pet_badges(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_co_owners_invited_by              ON public.pet_co_owners(invited_by);
CREATE INDEX IF NOT EXISTS idx_pet_medications_added_by              ON public.pet_medications(added_by);
CREATE INDEX IF NOT EXISTS idx_pet_medications_case_id               ON public.pet_medications(case_id);
CREATE INDEX IF NOT EXISTS idx_pet_medications_pet_id                ON public.pet_medications(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_vaccines_added_by                 ON public.pet_vaccines(added_by);
CREATE INDEX IF NOT EXISTS idx_pet_vaccines_pet_id                   ON public.pet_vaccines(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_vitals_pet_id                     ON public.pet_vitals(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_vitals_recorded_by                ON public.pet_vitals(recorded_by);
CREATE INDEX IF NOT EXISTS idx_pets_owner_id                         ON public.pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id            ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id                 ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_resources_created_by                  ON public.resources(created_by);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_author_id            ON public.timeline_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_case_id              ON public.timeline_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_touchpoint_templates_created_by       ON public.touchpoint_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_touchpoints_case_id                   ON public.touchpoints(case_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_completed_by              ON public.touchpoints(completed_by);
