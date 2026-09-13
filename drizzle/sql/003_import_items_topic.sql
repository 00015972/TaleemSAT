-- ============================================================================
-- 003_import_items_topic.sql
--
-- `import_job_items` was written in 001, before the topics tier landed in 002.
-- The PDF extractor resolves a College Board "Skill" straight to a topic, so a
-- staged item needs somewhere to keep it — otherwise the topic is lost between
-- extraction and promotion, and every imported question would come out
-- untagged.
--
-- Also adds `page_image_url`: the rendered source page, kept as a review aid so
-- an admin can compare the transcription against the original. This is NOT the
-- question's figure — the page render includes the rationale, so it must never
-- be shown to a student. That is what `question_image_url` is for.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/003_import_items_topic.sql
--
-- Safe to re-run.
-- ============================================================================

alter table import_job_items
  add column if not exists topic_id uuid references topics(id) on delete set null;

alter table import_job_items
  add column if not exists page_image_url text;

create index if not exists import_job_items_topic_id_idx
  on import_job_items (topic_id);

comment on column import_job_items.topic_id is
  'Resolved from the source PDF''s Skill field at extraction time; copied onto the question at promotion.';
comment on column import_job_items.page_image_url is
  'Rendered source page, for admin review only. Contains the rationale — never surface to students.';
