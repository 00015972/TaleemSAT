-- ============================================================================
-- 009_drop_pdf_import_columns.sql
--
-- PDF vision-transcription import (src/trigger/extract-pdf.ts, lib/ai/vision.ts,
-- lib/import/pdf-text.ts, lib/import/reconcile.ts) has been removed. HTML is
-- now the only supported import format, so the columns that only ever held
-- PDF-run bookkeeping are dead. CSV import (app/api/admin/questions/import)
-- never had dedicated columns beyond the generic `questions` fields, so
-- nothing to drop there.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/009_drop_pdf_import_columns.sql
--
-- Safe to re-run. After applying, regenerate lib/supabase/types.ts (Supabase
-- type generation) so the generated types drop these columns too.
--
-- Not handled here: the `source-pdfs` Storage bucket and its objects. Buckets
-- aren't part of a SQL migration's blast radius — remove it manually from the
-- Supabase dashboard (Storage → source-pdfs) once you've confirmed nothing
-- still needs those files.
-- ============================================================================

alter table import_jobs
  drop column if exists source_pdf_path,
  drop column if exists trigger_run_id;

alter table import_jobs
  alter column source_format set default 'html';

alter table import_job_items
  drop column if exists page_image_url;
