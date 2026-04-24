-- ===========================================================
-- case_documents: add fields for AI plain-language analysis,
-- semantic file_type tag, and an explicit storage_path so we
-- can mint short-lived signed URLs without parsing public URLs.
-- ===========================================================

ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS storage_path   text,
  ADD COLUMN IF NOT EXISTS file_type      text,
  ADD COLUMN IF NOT EXISTS ai_summary     text,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

-- file_type is owner-selected at upload time. Keep the enum loose;
-- enforce values at the application layer so we can iterate without
-- another migration.
COMMENT ON COLUMN public.case_documents.file_type IS
  'Semantic doc category: lab_result, discharge_summary, specialist_report, imaging, vaccine_record, other. Application-enforced.';

COMMENT ON COLUMN public.case_documents.storage_path IS
  'Path within the case-files bucket. Used to mint signed URLs and to fetch the file server-side for AI analysis.';

-- Allow case owners (clients) and assigned staff to update ai_summary
-- on rows they can already SELECT. The edge function uses service-role
-- so it bypasses this anyway, but the policy keeps the rule visible
-- and lets future client-side reanalysis triggers work without
-- a service-role round-trip if we ever want that.
DROP POLICY IF EXISTS "Users can update ai_summary on accessible docs" ON public.case_documents;
CREATE POLICY "Users can update ai_summary on accessible docs"
  ON public.case_documents
  FOR UPDATE
  USING (
    (current_user_role() = ANY (ARRAY['admin'::text, 'vet_buddy'::text, 'practice_manager'::text]))
    OR (case_id = ANY (get_my_case_ids()))
  )
  WITH CHECK (
    (current_user_role() = ANY (ARRAY['admin'::text, 'vet_buddy'::text, 'practice_manager'::text]))
    OR (case_id = ANY (get_my_case_ids()))
  );
