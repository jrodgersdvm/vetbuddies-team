
ALTER TABLE case_access ADD COLUMN IF NOT EXISTS role text DEFAULT 'helper';
ALTER TABLE case_access ADD COLUMN IF NOT EXISTS display_name text;
