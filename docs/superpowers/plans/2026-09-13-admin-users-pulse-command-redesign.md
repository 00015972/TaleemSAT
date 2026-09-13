# Admin Users Pulse Command Redesign Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-13-admin-users-pulse-command-redesign-design.md`

## Goal

Replace the legacy admin Users table with the approved Pulse Command workspace, backed by real directory analytics, engagement and billing detail, internal notes, password-reset requests, CSV export, and the existing protected role/tier mutation path.

## Constraints

- Preserve all existing admin authorization, self-role, final-admin, and audit behavior.
- Keep service-role credentials and recovery links server-side.
- Preserve unrelated in-progress changes already present in `app/globals.css`, `drizzle/schema.ts`, and `lib/supabase/types.ts`.
- Aggregate attempt data in PostgreSQL instead of loading unbounded histories into Next.js.
- Scope visual styling to the Users route and support dark, light, mobile, and reduced-motion modes.

## Task 1 — Define and test workspace contracts

**Files:**

- Create `lib/admin/users.types.ts`
- Create `lib/admin/users.params.ts`
- Create `lib/admin/users.params.test.ts`
- Modify `lib/validation/schemas.ts`
- Modify `lib/validation/schemas.test.ts`

**Work:**

1. Define serializable summary, signal, directory-row, user-detail, note, recent-attempt, and certificate contracts.
2. Add strict parsing and normalization for search, role, tier, segment, sort, page, and export state.
3. Add user-note validation with trimmed 1–2,000 character bodies.
4. Add tests for malformed parameters, search bounds, default sorting, positive page clamping, and note validation.

**Verify:** Run the new parameter tests and existing validation tests.

## Task 2 — Add database support for analytics and notes

**Files:**

- Modify `drizzle/schema.ts`
- Create `drizzle/sql/017_admin_users_pulse_command.sql`
- Modify `lib/supabase/types.ts`

**Work:**

1. Add `admin_user_notes` with user and author foreign keys, trimmed-length check, and `(user_id, created_at desc)` index.
2. Add `admin_users_summary()` returning KPI and Live Signals counts.
3. Add `admin_users_directory(...)` returning filtered, sorted, paginated directory summaries with seven-day activity and a windowed result total.
4. Revoke RPC execution from public client roles and allow the server service-role path.
5. Add the generated-shape TypeScript definitions required for the table and RPC results without overwriting unrelated type edits.

**Verify:** Inspect SQL for stable UTC windows, de-duplicated segments, parameter validation, and deterministic sorting.

## Task 3 — Build the server query layer and route payload

**Files:**

- Create `lib/admin/users.ts`
- Rewrite `app/(admin)/admin/users/page.tsx`

**Work:**

1. Wrap the summary and directory RPCs in narrow server-only functions.
2. Build a bounded single-user detail query across users, subscriptions, attempts, questions, certificates, and notes.
3. Build a bounded CSV export-row query using the same validated filters and sorting as the directory.
4. Load summary and directory concurrently in the page route and preserve partial-failure information.
5. Pass normalized URL state, current admin ID, and serializable data into the client workspace.

**Verify:** Type-check the query contracts against the Supabase database types.

## Task 4 — Add protected user workflow endpoints

**Files:**

- Extend `app/api/admin/users/[id]/route.ts`
- Create `app/api/admin/users/[id]/notes/route.ts`
- Create `app/api/admin/users/[id]/password-reset/route.ts`
- Create `app/api/admin/users/export/route.ts`
- Create focused endpoint tests beside the routes or in `lib/admin/`

**Work:**

1. Add `GET /api/admin/users/[id]` for the complete drawer payload.
2. Keep the existing `PATCH` implementation and its protections intact while aligning its response shape with the drawer.
3. Add authenticated note list/create handlers with validation and non-sensitive audit records.
4. Add an authenticated password-reset request that sends through Supabase Auth and never exposes a recovery URL.
5. Add filtered UTF-8 CSV export with safe field escaping, attachment headers, and a 10,000-row limit.
6. Cover non-admin access, invalid IDs, validation, audit behavior, and privacy boundaries.

**Verify:** Run focused API tests and inspect every service-role entry point for an early `requireAdmin()` gate.

## Task 5 — Build the Pulse Command component system

**Files:**

- Replace `components/admin/users-table.tsx` with a compatibility export or remove its use
- Create `components/admin/users/users-workspace.tsx`
- Create `components/admin/users/user-metric-card.tsx`
- Create `components/admin/users/users-filters.tsx`
- Create `components/admin/users/user-directory.tsx`
- Create `components/admin/users/live-signals.tsx`
- Create `components/admin/users/user-command-drawer.tsx`
- Create drawer tab components under `components/admin/users/`
- Create `components/admin/users/user-utils.ts`
- Create `components/admin/users/user-utils.test.ts`

**Work:**

1. Implement the approved header, four KPI cards, filter workspace, directory, signals rail, empty/error states, and pagination.
2. Keep all directory state URL-backed, with immediate select behavior and debounced/Enter search.
3. Implement one mounted-session detail cache and localized pending/error state.
4. Implement the accessible drawer with focus entry, Escape close, scrim close, tab semantics, and focus restoration.
5. Wire role, tier, reset, note, copy, export, and Stripe-link actions to the protected endpoints.
6. Implement desktop table rows and mobile learner cards without primary-action overflow.
7. Add unit coverage for initials, dates, accuracy, activity labels, and stable error-code mapping.

**Verify:** Run component utility tests and keyboard-review the drawer behavior.

## Task 6 — Implement the visual and motion system

**Files:**

- Modify `app/globals.css`

**Work:**

1. Add a scoped `.users-pulse-*` namespace using the existing admin shell tokens.
2. Recreate the approved deep-green atmosphere, layered metric cards, activity bars, signal treatments, directory density, and drawer depth in dark mode.
3. Add an equally intentional warm light theme.
4. Add coordinated entrance, count-up, activity growth, hover, pending, drawer, and success motion.
5. Add tablet and mobile breakpoints, visible focus states, high-contrast status treatments, and a comprehensive reduced-motion override.
6. Avoid changing shared admin behavior or unrelated page styles.

**Verify:** Inspect desktop, tablet, and mobile layouts in both themes and with reduced motion.

## Task 7 — Verify the integrated redesign

**Files:** all changed files

**Work:**

1. Run focused parameter, validation, utility, and endpoint tests.
2. Run ESLint on changed TypeScript and TSX files.
3. Run `pnpm typecheck`.
4. Run `pnpm build`.
5. Run `git diff --check` and review the diff around pre-existing user changes.
6. Open authenticated `/admin/users` in Chrome and verify real values, filters, signals, pagination, drawer tabs, notes, reset confirmation, export, light/dark themes, mobile layout, keyboard focus, errors, and reduced motion.
7. Fix only issues within the approved Users redesign scope and rerun affected checks.
