
ALTER TABLE public.escalations
  ADD COLUMN escalation_type text,
  ADD COLUMN incident_notes text;
