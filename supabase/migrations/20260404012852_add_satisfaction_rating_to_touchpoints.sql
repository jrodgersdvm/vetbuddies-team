ALTER TABLE touchpoints ADD COLUMN IF NOT EXISTS satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5);
