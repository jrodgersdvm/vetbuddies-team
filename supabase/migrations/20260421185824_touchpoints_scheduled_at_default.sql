
-- scheduled_at has no default and is NOT NULL, causing every insert from the app to fail
-- since the app never sends scheduled_at. Set default to now() to match completed_at behavior.
ALTER TABLE touchpoints ALTER COLUMN scheduled_at SET DEFAULT now();
