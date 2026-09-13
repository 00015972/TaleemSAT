# Navigation and Practice Performance — Approved Design

## Status

Approved by the user on 2026-08-29. The user requested local application changes and a local database migration only; this work must not apply changes to the live Supabase project.

## Objective

Reduce authenticated page-navigation latency and make the Question Bank browse and practice-start flows scale with taxonomy size rather than total question and attempt history. Preserve all authentication guarantees, Row-Level Security (RLS), UI behavior, grading behavior, and the in-progress Bluebook Air redesign.

## Current bottlenecks

- `proxy.ts` calls `supabase.auth.getUser()` before every matched dynamic request. Server pages and API handlers then validate the same request again. Each `getUser()` contacts Supabase Auth.
- All authenticated student routes are dynamically rendered, so remote authentication and database work directly affects navigation latency.
- `computePracticeOverview()` downloads every published question for shared counts and every attempt belonging to the current user, then aggregates both collections in JavaScript.
- Starting a practice scope waits for `/api/practice/manifest`, then waits for `/api/practice/question` before showing the first question. Both requests pass through proxy and handler authentication.
- The manifest resolves a taxonomy slug in one query and fetches ordered question IDs in a second query.
- Existing indexes do not cover the published scope-and-order access pattern or distinct attempted-question aggregation as a unit.
- The Question Bank browse screen imports and hydrates the complete practice runner before the student chooses a deck.

## Scope

### Included

- Auth identity helpers used by authenticated pages and route handlers.
- Proxy matching and authentication behavior where needed to remove duplicated remote checks.
- The Question Bank overview query and TypeScript mapping.
- The practice manifest/bootstrap API flow and first-question loading.
- Postgres RPC functions, grants, and supporting indexes in a new local migration.
- A lazy client boundary between Question Bank browsing and the full practice runner.
- Focused documentation/type updates needed by these changes.

### Excluded

- Applying migrations or deploying application code to any live environment.
- Visual redesign or changes to existing practice interactions.
- Changing answer checking, scoring, attempt recording, RLS policy intent, subscription gating, or admin authorization.
- Broad analytics/dashboard query redesign beyond authentication call reduction.
- Introducing a new cache, queue, infrastructure service, or client state library.

## Chosen approach

Use a targeted end-to-end optimization:

1. Use cryptographically verified JWT claims for identity where a fresh Auth user record is unnecessary.
2. Aggregate practice overview data in Postgres and return a compact, fixed-shape result.
3. Bootstrap a practice run with its ID manifest and first safe question in one database RPC and one HTTP response.
4. Add indexes that match the read paths.
5. Load the full runner only after the user selects a practice scope.

This is preferred over a code-only change because code-only optimization leaves unbounded attempt downloads. It is preferred over middleware-owned identity headers because that design adds a second internal trust protocol for marginal benefit.

## Authentication architecture

### Verified claims helper

Add a request-cached server helper that calls `supabase.auth.getClaims()` and returns a small authenticated identity derived from verified claims:

- user ID from `sub`;
- email when present;
- user metadata when present.

Callers must treat missing or invalid claims as unauthenticated. `getSession()` must not be used for authorization because its cookie-derived user object is not independently verified.

Keep the existing request-cached `getUser()` helper for the few screens that genuinely require fresh Auth-server state. The dashboard will retain `getUser()` for its current email-confirmation check. All other callers that only need a user ID, email, or metadata should use verified claims.

### Proxy and API ownership

- Use verified claims in the proxy for page access gates while retaining the Supabase SSR cookie-refresh behavior.
- Exclude `/api` routes from the broad proxy matcher. API handlers already own their authentication and will validate claims exactly once. Public handlers remain explicitly public; protected and admin handlers remain responsible for their existing checks.
- Confirm every API handler in the excluded namespace either performs its own authentication/authorization or is intentionally public before changing the matcher.
- Add `/mock` to the explicit protected-page list for consistency with the authenticated app layout.
- Do not pass identity through client-controllable internal headers.

The proxy and a server-rendered page may both verify the same JWT, but with asymmetric project signing keys this verification is local after JWKS caching rather than two Auth-server round trips. If the configured project requires remote claims verification, retain correctness and document that deployment-region alignment remains important.

## Practice overview data flow

### Database RPC

Add an authenticated, `security invoker`, stable Postgres function that derives the user from `auth.uid()` and returns one flat row per taxonomy topic. Each row contains:

- subject ID, slug, name, and display order;
- category ID, slug, name, and display order;
- topic ID, slug, name, and display order;
- published-question counts for `all`, `easy`, `medium`, and `hard` at subject, category, and topic levels;
- distinct attempted-question counts for the same difficulty buckets and levels.

Question and attempt aggregates must be computed independently before joining them to taxonomy rows. This prevents multiplicative counts. Attempt counts use `count(distinct question_id)` so repeated answers preserve current progress semantics. Subject/category totals must include legacy questions with no topic, matching current behavior.

The function must not accept a user ID. It uses `auth.uid()` so one student cannot request another student's progress. Revoke execution from `public` and `anon`; grant it only to `authenticated` and `service_role`.

### Application mapping

Replace the current catalog cache and raw attempt download in `computePracticeOverview()` with one RPC call. TypeScript maps the flat RPC rows into the existing `PracticeOverview` contract, so `PracticeBrowse` and all visual components remain unchanged.

The response now grows with the small taxonomy tree, not with the number of published questions or the student's full history. No user-specific overview is placed in a shared Next.js cache.

## Practice bootstrap data flow

### Bootstrap RPC

Add a second authenticated, stable, `security invoker` function accepting:

- scope kind: `subject`, `category`, or `topic`;
- scope slug;
- optional difficulty: `easy`, `medium`, `hard`, or null for all.

The function validates its inputs, resolves the eligible published questions in SQL, and returns one JSON object containing:

- `ids`: the existing stable array of `{ id, difficulty }`, ordered by `created_at` and then `id`;
- `question`: the first question's student-safe fields, or null when the scope is empty.

The question object may contain only fields already returned by `GET /api/practice/question`: ID, passage, question text, image URL, chart SVG, tables, question type, options, difficulty, and tags. It must never contain `correct_answer`, accepted answers, or explanation.

The function derives authentication from the caller's JWT/RLS context and is executable only by authenticated users and the service role.

### API contract

Keep `GET /api/practice/manifest` as the browser-facing endpoint. It validates claims once, validates query parameters, calls the bootstrap RPC once, and returns:

```json
{
  "ids": [{ "id": "uuid", "difficulty": "easy" }],
  "question": { "id": "uuid" }
}
```

`ids` remains backward compatible. `question` is additive. Existing status behavior remains:

- `401` for missing/invalid authentication;
- `400` for missing or invalid scope/difficulty;
- `404` for an unknown or empty scope;
- `500` for an RPC/database failure.

The client seeds its in-memory question cache with the returned first question and renders it immediately. It then prefetches the next question using the existing ID endpoint. This removes the manifest-to-first-question HTTP/auth waterfall without changing subsequent navigation behavior.

## Index design

Create partial covering indexes for the read-heavy published manifest paths:

- `(subject_id, created_at, id) include (difficulty) where status = 'published'`;
- `(category_id, created_at, id) include (difficulty) where status = 'published'`;
- `(topic_id, created_at, id) include (difficulty) where status = 'published'`.

Create `(user_id, question_id)` on attempts to support distinct attempted-question aggregation. Keep existing indexes unless an exact duplicate is proven. Mirror new indexes in `drizzle/schema.ts` so the declarative schema and SQL migration do not drift.

These indexes favor the most common all-difficulty ordered run while still allowing difficulty filtering within an already narrow scope. Additional difficulty-leading indexes are deliberately excluded until production `EXPLAIN ANALYZE` data demonstrates a need.

## Client component boundaries

Refactor `PracticeShell` into two responsibilities while keeping its public server-component props unchanged:

1. A small browse/controller component renders `PracticeBrowse`, owns the selected scope and bootstrap loading/error/empty state, and starts the manifest request.
2. A dynamically imported `PracticeRunner` owns the existing manifest navigation, question cache, answers, flags, tools, timer, and exam chrome.

When a scope is selected, runner-chunk loading and the bootstrap fetch should begin together. The runner receives the scope, manifest, first question, subscription flag, and exit callback. Returning to "All topics" unmounts the runner and restores the existing browse view.

No state needs to survive leaving the runner beyond behavior already persisted independently, such as the split-pane ratio and global appearance settings.

## Error handling and compatibility

- Preserve all existing loading, empty, authentication, question-not-found, retry, and answer states.
- Surface missing/unapplied RPC migrations as a normal database error; do not silently return incorrect counts or bypass RLS.
- Preserve the exact `PracticeOverview`, manifest-entry, and question shapes consumed by UI code, except for the additive first-question bootstrap field.
- Preserve stable question ordering.
- Keep `GET /api/practice/question` as the fallback and subsequent-question endpoint.
- Do not expose answer keys or explanations through overview or bootstrap functions.
- Preserve current Pro/Elite gating and admin role checks.

## Local migration delivery

Create the next numbered SQL file under `drizzle/sql/`. The migration must be idempotent where practical (`create index if not exists`, `create or replace function`) and include explicit revoke/grant statements.

Do not run the migration against the configured Supabase project. The handoff must clearly state that the new application code requires this migration before deployment.

## Verification

### Static verification

- Run TypeScript checking.
- Run ESLint on every changed TypeScript/TSX file.
- Run a production Next.js build.
- Inspect the produced client-reference manifest or chunks to confirm the full practice runner is not in the initial browse component's synchronous dependency set.
- Review the SQL for safe-field selection, `auth.uid()` ownership, invoker security, explicit function privileges, stable ordering, and index/query alignment.

### Behavioral verification

- Unauthenticated student pages still redirect to login.
- Unauthenticated practice API calls still return `401`.
- Admin APIs continue to require an admin role after `/api` is removed from the proxy matcher.
- Overview totals match the current semantics at subject, category, topic, and difficulty levels, including repeated attempts and legacy null-topic questions.
- Empty and invalid scopes retain their existing outcomes.
- The first question appears from the manifest response without a second initial question request.
- Back, Next, navigator jumps, neighbor prefetch, retries, flags, highlights, timer, answer checking, and return-to-topics behavior remain unchanged.
- No current Bluebook Air or Question Bank browse styling changes.

### Performance success criteria

- Normal authenticated identity checks use verified claims rather than a fresh Auth-user network request unless the caller explicitly needs fresh Auth state.
- API requests perform one handler-owned identity validation rather than proxy plus handler validation.
- Question Bank overview transfers taxonomy-sized aggregate rows instead of all published questions and attempts.
- Practice start uses one HTTP request and one database RPC for the manifest plus first question.
- The initial Question Bank browse bundle excludes runner-only exam, reading-tool, and question-rendering code.

Live latency comparisons are deferred until the local migration is reviewed and deliberately applied to a non-production or production Supabase environment by the user.
