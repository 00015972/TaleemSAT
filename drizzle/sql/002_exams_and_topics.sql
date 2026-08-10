-- ============================================================================
-- 002_exams_and_topics.sql
--
-- Adds the two grouping concepts the product needs:
--   1. `topics` — a third taxonomy tier (subject -> category -> topic) that
--      drives the Practice page's per-topic cards.
--   2. `exams` / `exam_modules` / `exam_questions` — named, versioned mock
--      tests ("March 2026, Version A") built from four fixed modules, which is
--      what the Mock Test page's cards represent.
--
-- Apply after 001_import_pipeline.sql, via the Supabase SQL Editor.
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ─── 1. Topics ──────────────────────────────────────────────────────────────
-- The 8 categories stay as the College Board domains (used for analytics and
-- mapped straight from the source PDF's "Domain" field). Topics sit beneath
-- them as the finer, teaching-order units students actually practise by.
create table if not exists topics (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories(id) on delete cascade,
  slug          text not null unique,
  name          text not null,
  description   text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists topics_category_id_idx    on topics (category_id);
create index if not exists topics_display_order_idx  on topics (display_order);

alter table questions
  add column if not exists topic_id uuid references topics(id) on delete set null;
create index if not exists questions_topic_id_idx on questions (topic_id);

-- Pipeline output carries a topic through review as well.
alter table import_job_items
  add column if not exists topic_id uuid references topics(id) on delete set null;

comment on table topics is
  'Third taxonomy tier under categories. Drives the Practice page cards; the source PDF''s "Skill" field can suggest one at import.';


-- ─── 2. Exams (mock tests) ──────────────────────────────────────────────────
do $$ begin
  create type exam_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

-- Module 2 of each section comes in an easy or hard variant. In this model the
-- variant is fixed per exam version (the card labels state it up front) rather
-- than chosen adaptively from Module 1 performance.
do $$ begin
  create type module_variant as enum ('easy', 'hard');
exception
  when duplicate_object then null;
end $$;

create table if not exists exams (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,              -- e.g. 'March 2026'
  version       text not null,              -- e.g. 'A'
  year          integer not null,           -- e.g. 2026; groups the card rows
  status        exam_status not null default 'draft',
  display_order integer not null default 0,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$ begin
  alter table exams add constraint exams_title_version_unique unique (title, version);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create index if not exists exams_year_idx   on exams (year desc);
create index if not exists exams_status_idx on exams (status);

-- One row per section-module: RW M1, RW M2, Math M1, Math M2.
create table if not exists exam_modules (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references exams(id) on delete cascade,
  subject_id         uuid not null references subjects(id),
  module_number      smallint not null check (module_number in (1, 2)),
  -- null for Module 1 (there is only one); 'easy' | 'hard' for Module 2.
  variant            module_variant,
  time_limit_seconds integer,
  display_order      integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint exam_modules_variant_chk check (
    (module_number = 1 and variant is null) or
    (module_number = 2 and variant is not null)
  )
);

do $$ begin
  alter table exam_modules
    add constraint exam_modules_exam_subject_number_unique
    unique (exam_id, subject_id, module_number);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create index if not exists exam_modules_exam_id_idx on exam_modules (exam_id);

-- Ordered question list per module. `restrict` on question deletion so a
-- question that is part of a published exam cannot silently vanish from it.
create table if not exists exam_questions (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references exam_modules(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  position    integer not null,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table exam_questions
    add constraint exam_questions_module_position_unique unique (module_id, position);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

do $$ begin
  alter table exam_questions
    add constraint exam_questions_module_question_unique unique (module_id, question_id);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create index if not exists exam_questions_module_id_idx   on exam_questions (module_id);
create index if not exists exam_questions_question_id_idx on exam_questions (question_id);


-- ─── 3. Row-Level Security ──────────────────────────────────────────────────
-- Project convention: RLS on for every table, default-deny.
-- Topics and published exams are student-readable; writes are service-role only
-- (admin routes), matching how `questions` is handled.
alter table topics         enable row level security;
alter table exams          enable row level security;
alter table exam_modules   enable row level security;
alter table exam_questions enable row level security;

do $$ begin
  create policy topics_select_authenticated on topics
    for select to authenticated using (true);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy exams_select_published on exams
    for select to authenticated using (status = 'published');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy exam_modules_select_published on exam_modules
    for select to authenticated using (
      exists (select 1 from exams e where e.id = exam_modules.exam_id and e.status = 'published')
    );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy exam_questions_select_published on exam_questions
    for select to authenticated using (
      exists (
        select 1 from exam_modules m
        join exams e on e.id = m.exam_id
        where m.id = exam_questions.module_id and e.status = 'published'
      )
    );
exception
  when duplicate_object then null;
end $$;


-- ─── 4. updated_at maintenance (set_updated_at() defined in 001) ────────────
drop trigger if exists topics_set_updated_at on topics;
create trigger topics_set_updated_at
  before update on topics
  for each row execute function set_updated_at();

drop trigger if exists exams_set_updated_at on exams;
create trigger exams_set_updated_at
  before update on exams
  for each row execute function set_updated_at();

drop trigger if exists exam_modules_set_updated_at on exam_modules;
create trigger exam_modules_set_updated_at
  before update on exam_modules
  for each row execute function set_updated_at();
