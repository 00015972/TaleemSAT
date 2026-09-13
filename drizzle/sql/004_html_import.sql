-- ============================================================================
-- 004_html_import.sql
--
-- Adds a second import source: hand-converted, semantic HTML (an admin runs a
-- College Board PDF through an AI chat tool by hand, producing clean HTML per
-- the schema documented in docs/15-html-import-schema.md). `import_jobs` needs
-- to know which pipeline produced it and where the raw file lives; every other
-- staging column on `import_job_items` already fits both sources unchanged.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/004_html_import.sql
--
-- Safe to re-run.
-- ============================================================================

alter table import_jobs
  add column if not exists source_format text not null default 'pdf';

do $$ begin
  alter table import_jobs
    add constraint import_jobs_source_format_chk check (source_format in ('pdf', 'html'));
exception
  when duplicate_object then null;
end $$;

alter table import_jobs
  add column if not exists source_html_path text;

create index if not exists import_jobs_source_format_idx on import_jobs (source_format);

comment on column import_jobs.source_format is
  'Which pipeline produced this job: ''pdf'' (vision transcription) or ''html'' (deterministic DOM parse, no AI).';
comment on column import_jobs.source_html_path is
  'Path within the private source-html bucket, mirroring source_pdf_path. Null for pdf-sourced jobs.';
