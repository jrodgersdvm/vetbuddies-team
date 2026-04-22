
-- Drop the old status constraint and add the new one
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check;
ALTER TABLE cases ADD CONSTRAINT cases_status_check
  CHECK (status = ANY (ARRAY['Active'::text, 'Needs Attention'::text, 'Inactive'::text]));

-- Update any existing rows that used old status values
UPDATE cases SET status = 'Active'          WHERE status IN ('active', 'Monitoring', 'monitoring');
UPDATE cases SET status = 'Needs Attention' WHERE status IN ('urgent',  'Urgent');
UPDATE cases SET status = 'Inactive'        WHERE status IN ('resolved','Resolved', 'inactive');
