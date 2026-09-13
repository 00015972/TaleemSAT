-- ============================================================================
-- 005_chart_svg.sql
--
-- Some HTML question-bank exports embed a chart as real inline <svg> markup
-- (code-generated from the underlying data) rather than a pasted <img> data
-- URI. lib/import/html-questions.ts now extracts and sanitizes that markup
-- (lib/import/svg-sanitize.ts) instead of discarding it, so both staging and
-- the live questions table need somewhere to keep it.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/005_chart_svg.sql
--
-- Safe to re-run.
-- ============================================================================

alter table import_job_items
  add column if not exists chart_svg text;

alter table questions
  add column if not exists chart_svg text;

comment on column import_job_items.chart_svg is
  'Sanitized inline <svg> chart markup extracted from an HTML import, mirroring question_image_url for code-generated (not pasted) figures.';
comment on column questions.chart_svg is
  'Sanitized inline <svg> chart markup, rendered directly (see components/reading/chart-figure.tsx). Mutually exclusive with question_image_url in practice.';
