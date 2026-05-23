# 02 — Database Schema

> Full Postgres schema running on Supabase. Every table, column, index, and Row-Level Security policy.
> Cross-refs: [01-architecture.md](01-architecture.md) · [05-security.md](05-security.md) · [03-api-reference.md](03-api-reference.md)

---

## ER overview

```
users ──┬── attempts ──── questions ─── categories ─── subjects
        │
        ├── qod_answers ── qod_schedule ─── questions
        │
        ├── certificates
        │
        ├── points_ledger
        │
        ├── ai_insights
        │
        ├── subscriptions ─── stripe_events
        │
        └── email_subscriptions
```

---

## Conventions

- All tables `lowercase_snake_case`.
- Primary key column is always `id uuid default gen_random_uuid() primary key`.
- Every table has `created_at timestamptz not null default now()`.
- Mutable tables have `updated_at timestamptz not null default now()` + trigger.
- Foreign keys use `references ... on delete <cascade|restrict|set null>` explicitly.
- Soft delete via `deleted_at timestamptz` only where users can delete their own data; otherwise hard delete.
- Always index foreign keys.

---

## Tables

### `subjects`
The two top-level groupings.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `slug` | text | unique not null | e.g. `english`, `math` |
| `name` | text | not null | e.g. `Reading & Writing`, `Math` |
| `display_order` | int | not null default 0 | |
| `created_at` | timestamptz | not null default now() | |

**Seed data:**
```sql
insert into subjects (slug, name, display_order) values
  ('english', 'Reading & Writing', 1),
  ('math', 'Math', 2);
```

---

### `categories`
The 8 categories (4 English + 4 Math).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `subject_id` | uuid | FK → subjects(id) on delete restrict | |
| `slug` | text | not null | e.g. `craft-and-structure` |
| `name` | text | not null | |
| `description` | text | | shown on category cards |
| `display_order` | int | not null default 0 | |
| `created_at` | timestamptz | not null default now() | |

**Unique:** `(subject_id, slug)`
**Index:** `(subject_id)`

**Seed data:** see [11-content-pipeline.md](11-content-pipeline.md) for the full list.

---

### `users`
Authenticated users. This is our application-level user table; Supabase's `auth.users` is the canonical auth record. We mirror via trigger.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, FK → auth.users(id) on delete cascade | matches Supabase auth UID |
| `email` | text | unique not null | |
| `full_name` | text | not null | |
| `target_sat_score` | int | check (target_sat_score between 400 and 1600) | optional, set at signup |
| `exam_date` | date | | optional, set at signup |
| `tier` | text | not null default 'free' check (tier in ('free','pro','elite')) | |
| `role` | text | not null default 'student' check (role in ('student','admin')) | admin = full access |
| `stripe_customer_id` | text | unique | null until first checkout |
| `subscription_id` | text | unique | current active Stripe subscription |
| `subscription_status` | text | | `active`, `past_due`, `canceled`, null |
| `current_period_end` | timestamptz | | for grace-period logic |
| `streak_days` | int | not null default 0 | consecutive days with a QOD answer |
| `last_qod_answered_at` | date | | for streak tracking |
| `marketing_opt_in` | boolean | not null default true | from signup form |
| `created_at` | timestamptz | not null default now() | |
| `updated_at` | timestamptz | not null default now() | |
| `deleted_at` | timestamptz | | soft delete for account deletion requests |

**Indexes:**
- `(email)` — automatic via unique
- `(tier)` for tier-based queries
- `(stripe_customer_id)` for webhook lookups
- `(last_qod_answered_at)` for streak recovery jobs

---

### `questions`
The question bank.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `category_id` | uuid | FK → categories(id) on delete restrict | |
| `subject_id` | uuid | FK → subjects(id) on delete restrict | denormalized for fast filtering |
| `question_text` | text | not null | the question stem |
| `passage` | text | | optional passage above the question |
| `option_a` | text | not null | |
| `option_b` | text | not null | |
| `option_c` | text | not null | |
| `option_d` | text | not null | |
| `correct_answer` | char(1) | not null check (correct_answer in ('A','B','C','D')) | |
| `explanation` | text | not null | full explanation shown after answering |
| `difficulty` | text | not null default 'medium' check (difficulty in ('easy','medium','hard')) | |
| `status` | text | not null default 'draft' check (status in ('draft','published','archived')) | only `published` are shown to students |
| `tags` | text[] | not null default '{}' | e.g. `{'quadratic','factoring'}` for fine-grained analysis |
| `created_by` | uuid | FK → users(id) on delete set null | admin who authored |
| `created_at` | timestamptz | not null default now() | |
| `updated_at` | timestamptz | not null default now() | |

**Indexes:**
- `(category_id, status)` — main read pattern: list published questions in a category
- `(subject_id, status)` — admin filters by subject
- `(status)` — admin "show all published"
- `gin(tags)` — tag-based filtering

---

### `attempts`
Every time a student answers a practice question.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `question_id` | uuid | FK → questions(id) on delete restrict | |
| `selected_answer` | char(1) | not null check (selected_answer in ('A','B','C','D')) | |
| `is_correct` | boolean | not null | |
| `time_taken_ms` | int | check (time_taken_ms >= 0) | how long they spent |
| `context` | text | not null default 'practice' check (context in ('practice','qod','mock')) | |
| `created_at` | timestamptz | not null default now() | |

**Indexes:**
- `(user_id, created_at desc)` — user's history page
- `(user_id, question_id)` — has this user seen this question?
- `(question_id)` — question performance analytics
- `(user_id, context, created_at)` — analytics queries

**No `updated_at`** — attempts are immutable.

---

### `qod_schedule`
Which question is the QOD on which day. Admin sets this in advance.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `scheduled_date` | date | unique not null | exactly one QOD per day |
| `question_id` | uuid | FK → questions(id) on delete restrict | |
| `created_by` | uuid | FK → users(id) on delete set null | admin who scheduled |
| `created_at` | timestamptz | not null default now() | |

**Indexes:**
- `(scheduled_date)` — unique
- `(question_id)` — find which days a question has been QOD (prevent reuse)

---

### `qod_answers`
A student's answer to a specific day's QOD. One row per (user, date).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `qod_schedule_id` | uuid | FK → qod_schedule(id) on delete restrict | |
| `selected_answer` | char(1) | not null check (selected_answer in ('A','B','C','D')) | |
| `is_correct` | boolean | not null | |
| `points_awarded` | int | not null default 0 | typically 0 or 1 |
| `created_at` | timestamptz | not null default now() | |

**Unique:** `(user_id, qod_schedule_id)` — one attempt per user per day.
**Indexes:**
- `(user_id, created_at desc)` — user's QOD history
- `(qod_schedule_id)` — daily aggregates ("X% of users got it right")

---

### `points_ledger`
Append-only ledger of every point earned. Source of truth for total points.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `amount` | int | not null | usually +1, but flexible |
| `reason` | text | not null check (reason in ('qod_correct','admin_adjustment','bonus','penalty')) | |
| `reference_id` | uuid | | e.g., qod_answers.id |
| `note` | text | | admin notes for manual adjustments |
| `created_at` | timestamptz | not null default now() | |

**Indexes:**
- `(user_id, created_at desc)` — user history
- `(user_id)` for sum/aggregates

**Why a ledger?** Auditable. We can always reconstruct a user's total: `select sum(amount) from points_ledger where user_id = ?`. If we ever issue a refund or correction, we add a row, not edit history.

---

### `certificates`
Each milestone earns a certificate (25 pts, 50 pts, 75 pts, etc).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `tier` | int | not null check (tier in (25,50,75,100,150,200)) | point milestone |
| `awarded_at` | timestamptz | not null default now() | |
| `pdf_storage_path` | text | | path in Supabase Storage (`certificates/{user_id}/{cert_id}.pdf`); null until generated |
| `pdf_generated_at` | timestamptz | | when the PDF was rendered |
| `recipient_name` | text | not null | snapshot of full_name at award time (in case user later changes name) |

**Unique:** `(user_id, tier)` — can only earn each tier once.
**Indexes:**
- `(user_id)` — list user's certificates

---

### `ai_insights`
Cached AI-generated insights so we don't re-call Claude on every page load.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `kind` | text | not null check (kind in ('weakness','study_plan','prediction')) | |
| `payload` | jsonb | not null | the AI response, structured |
| `prompt_hash` | text | not null | hash of input (attempt counts per category), used as cache key |
| `model` | text | not null | which Claude model produced this |
| `tokens_used` | int | | for cost tracking |
| `computed_at` | timestamptz | not null default now() | |
| `expires_at` | timestamptz | not null | usually +24h |

**Indexes:**
- `(user_id, kind, expires_at desc)` — read pattern: "latest valid insight of kind X for user Y"
- `(expires_at)` — cleanup job

See [09-ai-features.md](09-ai-features.md) for prompt design.

---

### `subscriptions`
Mirror of Stripe subscriptions. Source of truth for billing is Stripe; this is our read-optimized copy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users(id) on delete cascade | |
| `stripe_subscription_id` | text | unique not null | |
| `stripe_customer_id` | text | not null | |
| `status` | text | not null | `active`, `trialing`, `past_due`, `canceled`, etc. |
| `tier` | text | not null check (tier in ('pro','elite')) | |
| `current_period_start` | timestamptz | not null | |
| `current_period_end` | timestamptz | not null | |
| `cancel_at_period_end` | boolean | not null default false | |
| `canceled_at` | timestamptz | | |
| `created_at` | timestamptz | not null default now() | |
| `updated_at` | timestamptz | not null default now() | |

**Indexes:**
- `(user_id)` — most common read
- `(stripe_subscription_id)` — webhook lookups
- `(status, current_period_end)` — find users whose subscription expires soon

---

### `stripe_events`
Idempotency log for incoming Stripe webhooks.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `stripe_event_id` | text | unique not null | from `event.id` |
| `type` | text | not null | e.g. `checkout.session.completed` |
| `processed_at` | timestamptz | not null default now() | |
| `raw` | jsonb | not null | full event for replay/debug |

**Indexes:**
- `(stripe_event_id)` — unique, for idempotency check
- `(type, processed_at desc)` — debugging

---

### `email_subscriptions`
Mailing list for marketing/product emails. Separate from `users.marketing_opt_in` so we can support non-account subscribers later.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | text | unique not null | |
| `user_id` | uuid | FK → users(id) on delete set null | nullable for non-user signups |
| `source` | text | not null default 'signup' check (source in ('signup','landing','manual')) | |
| `unsubscribed_at` | timestamptz | | null = subscribed |
| `created_at` | timestamptz | not null default now() | |

---

## Row-Level Security (RLS) — overview

RLS is **on** for every table. Default-deny. Policies are listed by table below; full reasoning in [05-security.md](05-security.md).

### `users`
- **SELECT:** user can read their own row (`auth.uid() = id`). Admins can read all.
- **UPDATE:** user can update non-sensitive columns of their own row (no `tier`, `role`, `stripe_*`, `subscription_*`). Admins can update anything.
- **INSERT / DELETE:** disabled for client; only triggered by Supabase auth or server-side service role.

### `questions`
- **SELECT:** all authenticated users can read questions where `status = 'published'`. Admins can read all.
- **INSERT / UPDATE / DELETE:** admins only.

### `attempts`
- **SELECT:** user can read their own attempts. Admins can read all.
- **INSERT:** user can insert their own (`user_id = auth.uid()`). Server validates `is_correct`, can't be spoofed.
- **UPDATE / DELETE:** disabled. Attempts are immutable.

### `qod_schedule`
- **SELECT:** all authenticated users can read **today's** QOD schedule (filter at policy or query level). Admins can read all.
- **INSERT / UPDATE / DELETE:** admins only.

### `qod_answers`
- **SELECT:** user can read their own. Admins can read all.
- **INSERT:** user can insert their own. Server validates and enforces one-per-day.
- **UPDATE / DELETE:** disabled.

### `points_ledger`
- **SELECT:** user can read their own. Admins can read all.
- **INSERT:** **disabled for client.** Only the server (service role) writes here, to prevent point inflation.
- **UPDATE / DELETE:** disabled.

### `certificates`
- **SELECT:** user can read their own. Admins can read all.
- **INSERT / UPDATE / DELETE:** server-only.

### `ai_insights`
- **SELECT:** user can read their own. Admins can read all.
- **INSERT / UPDATE / DELETE:** server-only.

### `subscriptions`
- **SELECT:** user can read their own row. Admins can read all.
- **INSERT / UPDATE / DELETE:** server-only (Stripe webhook handler).

### `stripe_events`
- **SELECT / INSERT / UPDATE / DELETE:** server-only. Never exposed to clients.

### `email_subscriptions`
- **SELECT:** admin only. (Users don't need to see this table.)
- **INSERT:** any authenticated user can subscribe themselves; anonymous landing-page submissions go through a server route.
- **UPDATE:** for unsubscribe; user can update their own row.

---

## Triggers

### `updated_at` auto-touch
```sql
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to every table with updated_at:
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();
-- (Repeat for questions, subscriptions, etc.)
```

### Auto-create user row on signup
```sql
-- Fires after Supabase auth creates an auth.users row.
create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
```

### Streak update on QOD answer
Logic lives in the API route, not a trigger (easier to test and reason about).

---

## Migrations strategy

- All schema changes via Drizzle migrations checked into git: `drizzle/migrations/`.
- Naming: `0001_initial.sql`, `0002_add_certificates.sql`, etc.
- Each migration must be **forward-compatible** (old code can run against new schema). For breaking changes: split into two migrations, deploy code in between.
- **Never edit a migration after it's been applied to staging or prod.** Add a new one.
- Test every migration locally + on staging before prod.

---

## Seed & fixture data

- `seeds/01_subjects_categories.sql` — the 2 subjects + 8 categories.
- `seeds/02_demo_questions.sql` — ~20 published questions for local dev.
- `seeds/99_admin_user.sql` — creates a dev admin user (only run in dev).

Run on local: `pnpm db:seed`.

---

## Backup & PITR

- Supabase Pro: 7-day Point-In-Time Recovery (built-in).
- Weekly `pg_dump` to a Backblaze B2 bucket via GitHub Action (long-term retention).
- Quarterly restore drill: verify backups actually restore.

See [13-deployment-ops.md](13-deployment-ops.md).

---

**See next:** [03-api-reference.md](03-api-reference.md) for the endpoints that read/write these tables.
