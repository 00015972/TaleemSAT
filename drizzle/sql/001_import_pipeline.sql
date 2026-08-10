-- ============================================================================
-- 001_import_pipeline.sql
--
-- Adds:
--   1. Grid-in ("student-produced response") question support on `questions`.
--   2. `import_jobs` / `import_job_items` staging tables for the admin-panel
--      question-import pipeline (PDF extraction + AI generation).
--
-- Apply via the Supabase SQL Editor (Dashboard -> SQL Editor -> New query),
-- or `psql "$DATABASE_URL" -f drizzle/sql/001_import_pipeline.sql`.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ─── 1. Question type: mcq vs grid-in ───────────────────────────────────────
-- The real Digital SAT has both multiple-choice and student-produced-response
-- ("grid-in") questions. ~42% of a typical College Board Math export is grid-in.
do $$ begin
  create type question_type as enum ('mcq', 'grid_in');
exception
  when duplicate_object then null;
end $$;

alter table questions
  add column if not exists question_type question_type not null default 'mcq';

-- Grid-in answers have several equally-correct written forms (e.g. 3/2 and 1.5,
-- or .1764 / .1765 / 3/17). Store every accepted form; grading matches any.
alter table questions
  add column if not exists accepted_answers text[] not null default '{}'::text[];

comment on column questions.question_type is
  'mcq = 4 options + correct_answer in A-D. grid_in = no options; accepted_answers holds every valid form.';
comment on column questions.accepted_answers is
  'Grid-in only: all accepted written forms of the answer (e.g. {"3/2","1.5"}). Empty for mcq.';

-- Shape integrity per question type. NOT VALID so the constraint applies to new
-- and updated rows without failing the migration on any legacy row; validate
-- separately once existing data is confirmed clean (see bottom of this file).
do $$ begin
  alter table questions add constraint questions_type_shape_chk check (
    (question_type = 'mcq'
      and jsonb_array_length(options) = 4
      and correct_answer in ('A','B','C','D'))
    or
    (question_type = 'grid_in'
      and coalesce(array_length(accepted_answers, 1), 0) >= 1)
  ) not valid;
exception
  when duplicate_object then null;
end $$;


-- ─── 2. Import job staging tables ───────────────────────────────────────────
-- Pipeline output lands here for human review, NOT directly in `questions`.
-- `draft` on `questions` means "human-authored, awaiting publish"; unreviewed
-- machine output needs its own per-item state (verification failures, edits).

do $$ begin
  create type import_job_type as enum ('extract', 'generate');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type import_job_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type import_item_status as enum (
    'pending_review',      -- extracted/generated cleanly, awaiting a human
    'verification_failed', -- answer check disagreed; needs a human before use
    'approved',            -- promoted into `questions`
    'rejected'             -- discarded by a human
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists import_jobs (
  id              uuid primary key default gen_random_uuid(),
  type            import_job_type not null,
  status          import_job_status not null default 'queued',
  -- Extraction: {} . Generation: {subjectSlug, categorySlug, difficulty, count}.
  config          jsonb not null default '{}'::jsonb,
  source_pdf_path text,             -- path within the private `source-pdfs` bucket
  source_filename text,             -- original upload name, for display
  trigger_run_id  text,             -- Trigger.dev run id, for cross-referencing logs
  total_count     integer not null default 0,
  success_count   integer not null default 0,
  failed_count    integer not null default 0,
  error           text,
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists import_jobs_status_idx     on import_jobs (status);
create index if not exists import_jobs_created_by_idx on import_jobs (created_by);
create index if not exists import_jobs_created_at_idx on import_jobs (created_at desc);

create table if not exists import_job_items (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references import_jobs(id) on delete cascade,
  status        import_item_status not null default 'pending_review',
  -- Where this came from: PDF page number, College Board Question ID, or batch index.
  source_ref    text,

  subject_id    uuid references subjects(id),
  category_id   uuid references categories(id),

  question_type     question_type not null default 'mcq',
  question_text     text,
  passage           text,
  options           jsonb not null default '[]'::jsonb,
  correct_answer    text,
  accepted_answers  text[] not null default '{}'::text[],
  explanation       text,
  difficulty        difficulty,
  question_image_url text,

  -- Why this item passed or failed its answer check (solver vs verifier model).
  verification_notes jsonb,
  -- Output of validateQuestion() at staging time, so the reviewer sees blockers.
  validation_errors  jsonb,

  -- Set once promoted into `questions`; also prevents double-promotion.
  question_id   uuid references questions(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists import_job_items_job_id_idx  on import_job_items (job_id);
create index if not exists import_job_items_status_idx  on import_job_items (status);
create index if not exists import_job_items_job_status_idx on import_job_items (job_id, status);

comment on table import_job_items is
  'Staging area for pipeline output. Nothing reaches `questions` without passing validateQuestion() and a human approval.';


-- ─── 3. Row-Level Security ──────────────────────────────────────────────────
-- Project convention: RLS on for every table, default-deny. These tables are
-- only ever touched by admin API routes and Trigger.dev jobs via the service
-- role (which bypasses RLS), so no policies are defined — nothing else gets in.
alter table import_jobs      enable row level security;
alter table import_job_items enable row level security;


-- ─── 4. updated_at maintenance ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists import_jobs_set_updated_at on import_jobs;
create trigger import_jobs_set_updated_at
  before update on import_jobs
  for each row execute function set_updated_at();

drop trigger if exists import_job_items_set_updated_at on import_job_items;
create trigger import_job_items_set_updated_at
  before update on import_job_items
  for each row execute function set_updated_at();


-- ============================================================================
-- Optional follow-up, run once you've confirmed no legacy rows violate the
-- shape rule. If it errors, inspect the offenders with the SELECT below first.
--
--   select id, question_type, jsonb_array_length(options) as opt_count, correct_answer
--   from questions
--   where not (
--     (question_type = 'mcq' and jsonb_array_length(options) = 4
--       and correct_answer in ('A','B','C','D'))
--     or (question_type = 'grid_in'
--       and coalesce(array_length(accepted_answers, 1), 0) >= 1)
--   );
--
--   alter table questions validate constraint questions_type_shape_chk;
-- ============================================================================
