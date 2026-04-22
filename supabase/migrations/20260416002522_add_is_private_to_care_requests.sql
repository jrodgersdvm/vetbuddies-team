ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
