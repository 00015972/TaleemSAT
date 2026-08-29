# Navigation and Practice Performance Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-29-navigation-practice-performance-design.md`

**Goal:** Remove unnecessary Supabase Auth round trips, aggregate Question Bank progress in Postgres, bootstrap the first practice question with the manifest, and defer runner-only JavaScript until a deck is selected.

**Constraint:** Create all source and migration changes locally. Do not apply the SQL migration or deploy the application.

## Task 1: Introduce verified-claims identity

**Files:**

- Modify `lib/supabase/server.ts`
- Modify `proxy.ts`
- Modify authenticated page/layout callers under `app/(app)` and `app/(admin)`
- Modify `lib/admin/require-admin.ts`
- Modify authenticated API handlers under `app/api`

**Steps:**

1. Add a request-cached `getClaimsUser()` helper that maps verified `getClaims()` output to the existing minimal `id`, `email`, and `user_metadata` shape.
2. Keep `getUser()` for the dashboard's fresh email-verification check.
3. Replace other page, layout, admin-gate, and API identity calls with `getClaimsUser()`.
4. Change proxy authentication from `getUser()` to `getClaims()` and protect `/mock` explicitly.
5. Exclude `/api` from the proxy matcher after confirming every non-public API handler owns authentication.
6. Type-check before continuing so identity-shape incompatibilities are found early.

## Task 2: Add local performance migration and generated-function types

**Files:**

- Create `drizzle/sql/010_practice_performance.sql`
- Modify `drizzle/schema.ts`
- Modify `lib/supabase/types.ts`

**Steps:**

1. Create partial published-question indexes for subject, category, and topic ordered manifests.
2. Create an attempts `(user_id, question_id)` index.
3. Add `get_practice_overview()` as a stable, invoker-security RPC using `(select auth.uid())`, independent aggregates, and distinct attempted questions.
4. Add `get_practice_run(scope_kind, scope_slug, difficulty)` as a stable, invoker-security RPC returning the ordered manifest plus only safe first-question fields.
5. Revoke function execution from `public` and `anon`; grant only `authenticated` and `service_role`.
6. Mirror representable index definitions in Drizzle. Because Drizzle 0.45 cannot express PostgreSQL `INCLUDE`, represent `difficulty` as the final indexed key in both SQL and Drizzle, preserving covering-index behavior without schema drift.
7. Add both function signatures and result types to the generated Supabase type surface.
8. Review the SQL for idempotence, null-auth behavior, stable order, null-topic compatibility, and answer-key exclusion.

## Task 3: Replace raw overview downloads with one RPC

**Files:**

- Modify `lib/practice/overview.ts`
- Modify `app/(app)/question-bank/page.tsx`
- Modify `app/api/practice/overview/route.ts`

**Steps:**

1. Remove the shared raw-question catalog cache and its invalidation export.
2. Define the flat RPC row type and map it into the unchanged `PracticeOverview` tree.
3. Change `computePracticeOverview()` to call `get_practice_overview()` without accepting a user ID.
4. Update both callers.
5. Remove obsolete catalog revalidation calls/imports from admin question-write handlers because aggregate results are computed in Postgres per request.

## Task 4: Bootstrap the manifest and first question together

**Files:**

- Modify `app/api/practice/manifest/route.ts`
- Modify or create shared practice types under `components/practice`
- Modify the Question Bank controller/runner files from Task 5

**Steps:**

1. Validate scope kind, slug, and difficulty at the route boundary.
2. Call `get_practice_run()` once.
3. Preserve existing status codes and `ids`, adding the safe `question` field.
4. Seed the runner's in-memory cache and initial state from `question`.
5. Confirm the first render does not call `/api/practice/question`; subsequent cache misses still do.

## Task 5: Split browse and runner bundles

**Files:**

- Modify `components/practice/practice-shell.tsx`
- Create `components/practice/practice-runner.tsx`
- Optionally create `components/practice/types.ts` for shared contracts

**Steps:**

1. Keep `PracticeShell` as the small public controller that renders `PracticeBrowse` and starts the bootstrap fetch.
2. Move exam chrome, tools, question state, question rendering, navigation, and helper components into `PracticeRunner` without changing behavior or styles.
3. Load `PracticeRunner` through `next/dynamic` only after scope selection; allow chunk loading and bootstrap fetching to overlap.
4. Pass manifest, first question, scope, Pro status, and exit callback into the runner.
5. Preserve loading, empty, and error screens and unmount the runner on return to topics.

## Task 6: Verify the integrated change

**Files:** all changed files

**Steps:**

1. Run `pnpm typecheck`.
2. Run ESLint on changed TypeScript/TSX files.
3. Run `pnpm build`.
4. Inspect the Question Bank client-reference manifest to confirm runner-only modules are not synchronous page dependencies.
5. Run `git diff --check` and review the final diff for accidental UI changes or secret exposure.
6. Report that `010_practice_performance.sql` must be applied before deploying the dependent application code and that it was not applied during this work.

