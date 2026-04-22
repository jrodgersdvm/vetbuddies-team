
-- Tighten case_id (safe: table has 0 rows)
ALTER TABLE escalations
  ALTER COLUMN case_id SET NOT NULL;

-- New columns
ALTER TABLE escalations
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent','normal','fyi')),
  ADD COLUMN IF NOT EXISTS context_bundle JSONB,
  ADD COLUMN IF NOT EXISTS dvm_response TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_message_id UUID REFERENCES messages(id);

-- Constrain escalation_type to the enum from Foundations scenarios
ALTER TABLE escalations
  DROP CONSTRAINT IF EXISTS escalations_type_check,
  ADD CONSTRAINT escalations_type_check
    CHECK (escalation_type IN (
      'clinical_concern',
      'owner_distress',
      'owner_vet_conflict',
      'out_of_scope',
      'safety_concern',
      'unsure'
    ) OR escalation_type IS NULL);

-- Indexes for the admin queue
CREATE INDEX IF NOT EXISTS idx_escalations_open_queue
  ON escalations(created_at DESC)
  WHERE status = 'Open';

CREATE INDEX IF NOT EXISTS idx_escalations_status_priority
  ON escalations(status, priority, created_at);
