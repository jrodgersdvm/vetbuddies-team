ALTER TABLE appointments ADD COLUMN status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled'));
