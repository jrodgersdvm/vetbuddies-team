ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read_by_buddy boolean DEFAULT false;
