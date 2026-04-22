
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS profile_frame text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS legacy_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS care_story text;
