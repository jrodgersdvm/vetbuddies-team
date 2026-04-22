
-- Add content column to store the living care plan as JSON text
-- The app serializes the full living care plan (pet_profile, care_team,
-- active_care_goals, engagement_log, milestones_and_wins) into this field
ALTER TABLE public.care_plans ADD COLUMN content text;
