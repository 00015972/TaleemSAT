# 08 — Admin Panel

> What admins can do, how the panel is organized, and the operational workflows.
> Cross-refs: [03-api-reference.md](03-api-reference.md) · [11-content-pipeline.md](11-content-pipeline.md)

---

## Who is an admin

A user whose `users.role = 'admin'`. Set manually in Supabase SQL editor for the first admin; subsequent admins can be promoted via a tiny "promote admin" SQL snippet documented in the runbook.

At launch: **two admins** — Mirsodiq (builder) and Bahromjon (instructor). Both have full powers.

---

## How admin access works

- URL: `/admin/*` routes (separate route group with its own layout).
- Middleware checks `user.role === 'admin'` on every request. Non-admins get a 404 (not 403 — we don't even acknowledge the route exists).
- Admins still have a regular `tier` (typically `elite`) so they can experience the product as a student.
- Admins can switch to "student view" via a toggle in the admin header — shows the dashboard as a regular student would see it.

### Security
- MFA required (manually enforced for now; we make Bahromjon set it up via Supabase Auth dashboard).
- Admin session expires after 24 hours (vs 7 days for students).
- All destructive actions log to `audit_log` table.

---

## Admin panel structure

```
/admin
├── /admin                  ← Dashboard (overview metrics)
├── /admin/questions        ← Question CRUD
│   └── /admin/questions/import   ← CSV import flow
├── /admin/qod              ← QOD scheduling
├── /admin/users            ← User management
├── /admin/subscriptions    ← Subscription overview (read-only)
└── /admin/settings         ← Admin-only system settings (Phase 10+)
```

### Layout
- Side nav (left, sticky): Dashboard, Questions, QOD, Users, Subscriptions, Settings.
- Top bar: brand mark, "Student view" toggle, admin name, log out.
- Visual signal: thin gold bar across the top to make admin obvious — never mistake admin pages for student pages.

---

## Admin Dashboard (`/admin`)

The home page. Snapshot of platform health.

### Top row — KPIs
4 cards across:
- **Total users** with delta (24h, 7d)
- **Active subscribers** (Pro + Elite) with MRR estimate
- **DAU / WAU / MAU** trio
- **Questions live** — published count out of total

### Engagement section
- QOD today: number of responses, accuracy rate.
- Attempts last 24h (line chart, hourly).
- Top categories by volume (last 7 days).
- Average daily streak across users.

### Health section
- Errors caught by Sentry today (link out).
- Latest 5 Stripe events (link to webhook log).
- AI cost today (sum of tokens × rate).

### Alerts
- "No QOD scheduled for tomorrow" — red banner.
- "X subscriptions in past_due" — orange banner.
- "Y users joined today but didn't verify email" — info.

---

## Questions (`/admin/questions`)

### List view
- Paginated table:
  - Checkbox
  - ID (short)
  - Question preview (first 80 chars)
  - Subject
  - Category
  - Difficulty
  - Status
  - Created date
  - Actions: Edit, Preview, Archive
- Filters (sticky toolbar):
  - Subject dropdown
  - Category dropdown (cascades from subject)
  - Difficulty
  - Status (draft / published / archived)
  - Search by text
- Bulk actions on selected:
  - Publish
  - Archive
  - Delete (admin confirm)
  - Tag (add/remove)

### Add/Edit question
Form fields:
- Subject (select)
- Category (select, cascades)
- Question text (textarea, supports limited HTML — `<em>`, `<sup>`, `<sub>`)
- Passage (optional, textarea)
- Option A, B, C, D (text inputs)
- Correct answer (radio: A/B/C/D)
- Explanation (textarea, **required** — we never publish without explanation)
- Difficulty (radio: easy/medium/hard)
- Tags (multi-input with autocomplete from existing tags)
- Status (draft / published / archived)

Right side: **Live preview panel** showing the question as a student would see it. Updates as the admin types.

Save buttons:
- "Save as draft" — saves with status=draft
- "Save and publish" — saves with status=published, runs final validation (all required fields filled)

### Validation rules
- All 4 options must be non-empty.
- `correct_answer` must be one of A/B/C/D.
- `question_text` minimum 10 characters.
- `explanation` minimum 30 characters (we want substantive explanations).
- If `passage` is provided, must be at least 50 characters (otherwise just put it in `question_text`).

### Preview button
Opens the question in a modal styled exactly like the student practice view — admin can answer it themselves to spot bugs.

### Archive vs Delete
- **Archive** sets `status = 'archived'` — question no longer appears in random pool but historical attempts remain valid.
- **Delete** is hidden — only available via SQL. We never want to lose questions that have student history.

### Question history (future)
- Edit history: who changed what, when. Useful when we have multiple admins.

---

## CSV Import (`/admin/questions/import`)

### Workflow
1. Click "Import CSV" button.
2. Modal opens with three sections:
   - **Format guide** (collapsible)
   - **Drag-and-drop area** + "or browse"
   - **Download template** link → static CSV with one example row
3. Drop CSV → server parses, returns preview of first 5 rows.
4. Admin reviews preview → "Import 187 questions" (count detected, rounded).
5. Progress indicator during import.
6. Result screen:
   - "187 imported (status: draft)"
   - "13 errors:" table with row number + reason
   - "Download error report" → CSV with original rows + reason column

### CSV format
Full spec in [11-content-pipeline.md](11-content-pipeline.md). Quick reference:

| Column | Required | Notes |
|---|---|---|
| subject | yes | "English" or "Math" |
| category | yes | category name (must match exactly) |
| question_text | yes | the stem |
| passage | no | optional |
| option_a | yes | |
| option_b | yes | |
| option_c | yes | |
| option_d | yes | |
| correct_answer | yes | A, B, C, or D |
| explanation | yes | |
| difficulty | yes | easy / medium / hard |
| tags | no | semicolon-separated, e.g. `quadratic;factoring` |

### Default behavior
- Imported rows land as `status = 'draft'`. Admin reviews + bulk-publishes after.
- Duplicates (matched by question_text + correct_answer) are **skipped, not overwritten**. Reason listed in error report.

---

## QOD scheduling (`/admin/qod`)

### Layout
- **Calendar view** at the top — past month + upcoming 30 days. Each day shows the QOD's category (color-coded) or "Empty" if not scheduled.
- **Today's QOD card** — full preview, response count, accuracy %.
- **Upcoming list** — scheduled QODs, click to view or unschedule (only future).
- **Past list** — historical QODs with response stats.

### Schedule a QOD
1. Click an empty day in calendar (or "Schedule for tomorrow" CTA).
2. Question picker modal opens:
   - Search bar + filters (subject, category, difficulty)
   - List of questions, with a "Used as QOD on" badge if previously scheduled
   - Click question → preview on right side
3. Confirm → row inserted into `qod_schedule`.

### Rotation prevention
- The picker warns if a question was used as QOD within the last 90 days.
- Hard-prevents re-use within 30 days (configurable).
- Why? To ensure freshness and prevent students from seeing the same question twice in a season.

### Auto-suggest (Phase 10)
- Pick from questions with high difficulty + low recent attempt count.
- Suggest a balance across categories.

### Unschedule
- Only future-dated QODs can be unscheduled.
- Confirmation required.

---

## Users (`/admin/users`)

### List view
- Table:
  - Email
  - Full name
  - Tier (badge: Free/Pro/Elite)
  - Role (badge: Student/Admin)
  - Streak
  - Total points
  - Created date
  - Last active
- Filters: tier, role, streak >0, exam date upcoming
- Search by name or email

### User detail view (`/admin/users/:id`)

Sections:
- **Profile** — name, email, exam date, target score, tier, role, marketing opt-in
- **Subscription** — current plan, status, next renewal, Stripe customer link
- **Activity** — last login, total attempts, accuracy, streak
- **Points ledger** — last 20 entries
- **Certificates earned** — list with download links (admin can download anyone's cert)
- **Recent attempts** — last 50 with question link
- **Admin notes** — free-text textarea for admin notes (e.g., "Refunded via Stripe on 5/12")

### Admin actions on a user
- **Change tier manually** (e.g., gift Pro to a beta tester) — writes audit log entry
- **Adjust points** — adds a `points_ledger` entry with reason=admin_adjustment + note
- **Reset password** — sends Supabase password reset
- **Toggle email verified** — for support cases
- **Soft delete** — sets `deleted_at`, account becomes non-functional but data retained for 30 days
- **Hard delete** — only via SQL with confirmation; complies with GDPR delete request

All actions show a confirmation modal with the action + reason field.

---

## Subscriptions (`/admin/subscriptions`)

Mostly read-only. Stripe is the source of truth; we mirror.

### List view
- Table of all active + recent subscriptions
- Status, tier, started, current period end, cancel-at-period-end flag
- Link to Stripe dashboard for each

### Filters
- Status (active / past_due / canceled)
- Tier (pro / elite)
- Period end within X days

### Actions
- Open in Stripe (link out)
- **No edits from here** — go through Stripe dashboard or have the user use the portal

### Past-due management
- "Past due" tab shows subscriptions stuck.
- For each: see when first failed, days remaining in grace period.
- We don't have direct retry — Stripe handles, we just monitor.

---

## Settings (`/admin/settings`) — Phase 10+

Reserved for future:
- Feature flags toggle
- Maintenance mode toggle
- Manual cache purge
- Email broadcast composer
- Promo code creation (Stripe)

---

## Audit log

### Schema (Phase 4 addition to [02-database-schema.md](02-database-schema.md))
```
audit_log
- id uuid PK
- actor_user_id uuid FK users(id)
- action text  -- 'question.create', 'user.tier_change', etc.
- target_type text  -- 'question', 'user', 'qod'
- target_id uuid
- before jsonb
- after jsonb
- note text
- created_at timestamptz
```

### What's logged
- All admin actions on the question bank (create, update, archive, import)
- QOD schedule changes
- User role / tier changes
- Manual points adjustments
- Admin password resets

### What's not logged
- Read actions (would be too noisy)
- Login successes (Supabase logs these)

### Viewing
- `/admin/audit` (Phase 10) — filterable list
- For now: Supabase SQL editor query

---

## Admin onboarding

The admin panel must be usable by Bahromjon without a tech background. Specifically:

### Must be self-explanatory
- Every button label says what it does.
- Every form has helper text where ambiguous.
- No jargon — say "Publish" not "Set status to published".

### Must have safety nets
- Destructive actions require confirmation.
- Bulk operations preview the affected items before executing.
- Undo where possible (e.g., archive is reversible).

### Must have good defaults
- New questions default to `draft`.
- Import default status: `draft`.
- Date pickers default to "tomorrow" for QOD scheduling.

### Quick training docs
We'll prepare a `docs/admin-guide.md` (different from this — written for non-technical Bahromjon) when Phase 4 ships. It will be a step-by-step with screenshots.

---

## Performance considerations

- Question list: pagination at 50/page. Search is server-side.
- Bulk operations capped at 200 items per request to avoid timeout.
- Stats dashboard queries are cached for 5 minutes (Vercel's data cache).
- CSV import processes in batches of 50 inserts.

---

## Mobile

Admin panel is **desktop-first**. It works on tablets but not optimized for phones. Bahromjon will use it from a laptop or desktop.

---

**See next:** [09-ai-features.md](09-ai-features.md) for how AI insights work behind the scenes.
