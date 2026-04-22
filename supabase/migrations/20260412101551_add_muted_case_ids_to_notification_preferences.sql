ALTER TABLE notification_preferences ADD COLUMN muted_case_ids uuid[] NOT NULL DEFAULT '{}';
