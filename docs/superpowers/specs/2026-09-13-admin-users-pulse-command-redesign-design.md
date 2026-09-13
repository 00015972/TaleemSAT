# Admin Users Pulse Command Redesign

**Date:** 2026-09-13  
**Status:** Approved for implementation planning  
**Route:** `/admin/users`  
**Selected concept:** Option A — Pulse Command

## Summary

Redesign the TaleemSAT admin Users page as **Pulse Command**, a lively user-operations workspace that balances fast account administration with real learner-engagement insight. The page retains the established admin shell and existing role and tier controls, but replaces the generic toolbar and table with live workspace metrics, an activity-rich directory, actionable signals, and a lazy-loaded user command drawer.

The redesign includes real backend support for directory analytics, detailed user records, internal admin notes, password-reset requests, and CSV export. It supersedes the unimplemented `2026-08-30-admin-users-pulse-desk-design.md` specification.

## Goals

1. Make role, tier, billing, and support work fast enough for daily administration.
2. Show which learners are active, improving, inactive, or at risk without leaving the directory.
3. Give the page a memorable visual identity through purposeful motion and a refined green-and-gold atmosphere.
4. Preserve existing authorization, audit, self-role, and final-admin protections.
5. Keep the initial page fast by separating directory summaries from lazy-loaded user details.

## Non-goals

- Suspending, deleting, or impersonating users.
- Editing a provider subscription directly from TaleemSAT.
- Sending marketing campaigns or arbitrary emails.
- Bulk role or tier mutation.
- Redesigning the shared admin shell or other admin routes.
- Building a general customer-support ticketing system.

## Visual direction

### Tone and identity

Pulse Command uses the approved dark concept's **learner pulse** motif: operational, energetic, and humane rather than clinical. It remains part of the existing admin cockpit, with deep green layered surfaces, restrained gold emphasis, fine grid or radial atmosphere, softly tinted shadows, and clear information density.

The memorable visual element is the seven-day activity rhythm repeated across the interface: KPI changes, directory activity bars, and signal counts feel connected to one live system.

### Typography and color

- Use the existing admin typography and design tokens rather than loading a route-specific font.
- Use strong, compact sans-serif headings with tabular figures for metrics, percentages, dates, and activity counts.
- Apply the approved readability refinement by increasing small interface typography approximately 15–20%. This includes filter labels and values, table headings, user metadata, badges, activity labels, signal-card copy, pagination, and drawer supporting text. Preserve the existing display-heading and KPI scale so the hierarchy remains distinct.
- Increase control and row heights only where the larger type requires breathing room; preserve the current workspace proportions and responsive structure.
- Green communicates activity and primary actions; gold is reserved for paid access, attention, and premium emphasis.
- Status always includes text or iconography and is never encoded by color alone.
- Light mode receives the same hierarchy using warm cream, white, green, and restrained gold surfaces.

### Motion

- Header, KPI cards, controls, and the first visible rows enter in a 50–80 ms stagger over approximately 600 ms.
- KPI values count up once on initial mount. Refreshes cross-fade without replaying the full entrance.
- Seven-day activity bars grow from their baseline once when rows appear.
- Cards lift no more than 3 px; rows translate no more than 3 px and reveal a narrow selection rail.
- The desktop drawer slides in over approximately 400 ms while its scrim fades slightly faster.
- Successful mutations use a short checkmark and tinted confirmation state. Errors do not shake.
- `prefers-reduced-motion: reduce` removes count-ups, stagger delays, translations, and bar growth while preserving immediate state feedback.

## Page structure

The workspace has five layers:

1. **Header:** live `User pulse` eyebrow, `People, in motion.` title, explanatory copy, and `Export users` action.
2. **Workspace metrics:** total learners, paid access, weekly active learners, and workspace health.
3. **Directory controls:** search, role, tier, segment, and sort controls, plus a reset action and visible active-filter count.
4. **Operations grid:** user directory on the left and Live Signals rail on the right.
5. **Pagination:** current result range, page position, and previous/next controls.

Selecting a user opens the command drawer over the current directory context. The directory remains visible behind a dimmed and lightly blurred scrim.

## Metric and signal definitions

All relative-day calculations use database time in UTC so results are stable across administrator time zones.

### Workspace metrics

- **Total learners:** count of all rows in `users`.
- **Paid access:** users whose current `users.tier` is `pro` or `elite`. This includes gifted access and is not presented as revenue.
- **Weekly active:** distinct users with at least one `attempts.created_at` timestamp in the trailing seven 24-hour periods.
- **Needs attention:** distinct union of users whose `subscription_status` is `past_due` or `incomplete`, and paid users created at least 14 days ago who have no attempt in the trailing 14 days.
- **Workspace health:** `100 × (paid access − needs attention) / paid access`, rounded to the nearest integer and clamped to 0–100. It displays `100%` when paid access is zero. The card also states the needs-attention count.

### Live Signals

- **Renewals at risk:** users with `past_due` or `incomplete` subscription status.
- **Quiet paid learners:** `pro` or `elite` users created at least 14 days ago with no attempt in the trailing 14 days.
- **Recent upgrades:** users with an active or trialing paid subscription created in the trailing seven days, or an audited `users.tier` change from `free` to `pro` or `elite` in the trailing seven days. Results are de-duplicated by user ID.

Selecting a signal applies the corresponding directory segment. Signals do not mutate user state.

## User directory

Each desktop row contains:

- avatar initials;
- full name and email;
- role badge;
- tier badge;
- seven-day attempt bars;
- latest practice time; and
- a disclosure button for the drawer.

The row data also includes user ID, joined date, subscription status, seven-day attempt count, total attempts, correct-attempt count, and aggregate accuracy. Low-priority details collapse at narrower breakpoints.

### Filters and sorting

Directory state is persisted in URL search parameters:

- `q`: partial name or email, or exact user UUID.
- `role`: `student` or `admin`.
- `tier`: `free`, `pro`, or `elite`.
- `segment`: `attention`, `renewal-risk`, `inactive-paid`, `recent-upgrade`, or empty.
- `sort`: `newest`, `oldest`, `recent-activity`, or `lowest-accuracy`.
- `page`: one-based page number.

Select controls apply immediately. Search submits on Enter and after a short debounce. Any filter or sort change resets the page to one. An active segment appears as a removable chip.

## User command drawer

The drawer loads detail only after selection and has four tabs.

### Overview

- full name and email;
- user ID with copy action;
- role and tier;
- target SAT score and exam date;
- marketing preference;
- account creation date;
- current streak, longest streak, and total XP; and
- a concise learning-health summary derived from recent activity.

### Billing

- current plan and subscription status;
- provider;
- current-period end;
- cancellation-at-period-end state; and
- external Stripe customer link when a Stripe customer ID exists.

The drawer does not edit provider subscription records.

### Activity

- total attempts, correct attempts, and accuracy;
- most recent attempt time;
- recent attempts with question links; and
- earned certificates.

### Notes

- newest-first internal notes with author name and timestamp; and
- an add-note form with a trimmed 1–2,000 character body.

### Approved actions

- change role;
- change tier;
- request a password-reset email;
- copy email or user ID;
- add an internal note; and
- open the Stripe customer page when available.

Role and tier changes require confirmation when they grant or remove administrative or paid access. No delete, suspend, or impersonation action is included.

## Server architecture

### Page route

`app/(admin)/admin/users/page.tsx` remains the server entry point. It parses and normalizes search parameters, loads the workspace summary and current directory page concurrently, and passes a serializable payload to the client workspace.

Malformed enum values fall back to their empty/default states. Page values are clamped to a positive integer. Search input is trimmed, limited to 200 characters, and escaped before database filtering.

### Query module

Add `lib/admin/users.ts` as the server-only home for user workspace reads. It exposes narrow functions for:

- workspace summary;
- paginated directory results;
- single-user detail; and
- CSV export rows.

Database aggregation happens in SQL rather than loading unbounded attempts into application memory. Add service-role-only SQL functions:

- `admin_users_summary()` for workspace KPI values and signal counts.
- `admin_users_directory(...)` for a filtered and sorted page plus a windowed `filtered_total`.

Execution is revoked from public browser roles and granted only for the service-role path. The current attempts and user role/tier indexes support the queries; the migration may add an index only when its query plan demonstrates a need.

### Client components

Replace the monolithic `UsersTable` implementation with focused components under `components/admin/users/`:

- `users-workspace.tsx` owns filter state, URL navigation, pending state, drawer selection, and cached detail payloads.
- `user-metric-card.tsx` renders one animated KPI.
- `users-filters.tsx` owns labeled filter controls and search behavior.
- `user-directory.tsx` renders responsive table rows or mobile cards.
- `live-signals.tsx` renders actionable segments.
- `user-command-drawer.tsx` owns accessible dialog behavior and tab selection.
- tab content components render Overview, Billing, Activity, and Notes.

Only the workspace and drawer coordinate requests. Presentational components receive typed data and callbacks and do not duplicate authorization or server-query logic.

## API design

- `GET /api/admin/users/[id]`: drawer overview, billing, activity, certificates, and initial notes.
- `PATCH /api/admin/users/[id]`: existing role/tier mutation with current guards and audit logging.
- `POST /api/admin/users/[id]/password-reset`: requests one recovery email and writes a non-sensitive audit entry.
- `GET /api/admin/users/[id]/notes`: returns newest-first internal notes.
- `POST /api/admin/users/[id]/notes`: validates, stores, and audits a note without copying its body into the audit log.
- `GET /api/admin/users/export`: applies the current validated search, role, tier, segment, and sort state and returns a UTF-8 CSV attachment. Export is capped at 10,000 matching users; a larger result returns a clear limit error instead of silently truncating.

Every endpoint calls `requireAdmin()` before using the service-role client. Stable error codes map to contextual client messages.

## Data model addition

Add `admin_user_notes`:

- `id uuid primary key default gen_random_uuid()`;
- `user_id uuid not null references users(id) on delete cascade`;
- `author_user_id uuid references users(id) on delete set null`;
- `body text not null` with a database check enforcing trimmed length from 1 through 2,000 characters;
- `created_at timestamptz not null default now()`; and
- index `(user_id, created_at desc)`.

Notes are reachable only through admin-authenticated server routes. The audit entry stores the note ID and target user ID, never the note body.

## Data flow and mutation behavior

1. The server validates URL state and concurrently requests summary and directory data.
2. The client renders usable directory content without waiting for any user-detail request.
3. Selecting a learner opens the drawer shell immediately and requests its detail payload.
4. Successful drawer payloads are cached by user ID for the mounted workspace session.
5. A role, tier, reset, or note request disables only its affected control.
6. A successful mutation updates the cached drawer state where appropriate and refreshes the server route so summaries and directory rows stay authoritative.
7. A failed mutation restores prior control state, keeps the drawer open, and displays a contextual message.

## Loading, empty, and error states

- Summary and directory regions use shape-matched loading skeletons.
- The drawer keeps known identity visible while loading its detailed sections.
- No search matches shows the active filter summary and a `Clear filters` action.
- A genuinely empty user table uses a neutral first-user state.
- Summary failure renders em dashes and an accessible explanation while preserving the directory.
- Directory failure renders a bounded retry panel in place of results.
- Detail failure leaves the drawer open with retry and close actions.
- Mutation failures use an assertive live region, roll back optimistic UI, and preserve unsaved note text.
- Password-reset success confirms that an email was requested but never returns or displays a recovery link.

## Responsive behavior

- **Desktop:** four KPI columns; directory and signals rail side by side; right-side command drawer.
- **Tablet:** two KPI columns; signals move below the directory; low-priority activity columns collapse.
- **Mobile:** one or two KPI columns depending on width; directory becomes stacked cards; drawer becomes a full-screen sheet with sticky identity header, scrollable tabs, and sticky action footer.
- Primary identity, role, tier, activity status, and disclosure actions never require horizontal scrolling.

## Accessibility

- Every filter has a persistent label and visible focus treatment.
- User disclosure uses a real button with an accessible name.
- The drawer uses dialog semantics, traps focus, closes on Escape, and restores focus to its originating control.
- Status includes text or icons and is not conveyed by color alone.
- Activity bars include a textual screen-reader summary and are decorative otherwise.
- Success and error messages use polite and assertive live regions as appropriate.
- Light and dark themes target WCAG AA contrast for body text, controls, badges, and focus indicators.
- Reduced-motion mode removes non-essential animation without removing state cues.

## Security and privacy

- All reads and writes remain server-side and admin-gated.
- Existing self-role and final-admin protections remain unchanged.
- UUIDs, enums, note bodies, query strings, sorting, segments, page bounds, and export limits are validated server-side.
- Search syntax is escaped before reaching PostgREST or SQL functions.
- Service-role credentials, Stripe secrets, raw provider payloads, recovery links, and note bodies never enter audit logs or client-visible errors.
- Role, tier, password-reset, and note mutations create audit records.

## Verification strategy

### Unit tests

- Search-parameter parsing and normalization.
- Workspace health, weekly-active, needs-attention, and signal calculations, including zero-paid-user behavior.
- User initials, date labels, accuracy, and seven-day activity summaries.
- CSV escaping, ordering, filtering, and export-limit behavior.
- Stable error-code mapping.

### API and integration tests

- Non-admin access is rejected for every new endpoint.
- Invalid UUIDs, filters, notes, and export inputs are rejected.
- Existing self-role and final-admin guards continue returning the expected conflicts.
- Role and tier updates, reset requests, and notes write audit entries.
- Reset responses never expose recovery URLs.
- Notes enforce length, author attribution, user association, and newest-first order.
- Directory filtering, segment membership, sorting, total counts, and pagination remain consistent.

### Component and browser checks

- URL state restores after refresh and browser back/forward navigation.
- Search debounce and Enter submission produce the same URL state.
- Signal selection applies and clears its segment correctly.
- Drawer loading, caching, retry, focus trap, Escape close, and focus restoration work.
- Mutations isolate pending state and roll back on failure.
- Desktop, tablet, and mobile layouts work without primary-action overflow.
- Light, dark, loading, empty, partial-error, and reduced-motion states pass visual review.
- `pnpm typecheck`, targeted tests, and lint for changed files pass.

## Acceptance criteria

The redesign is complete when:

1. `/admin/users` matches the approved Pulse Command hierarchy and visual direction in both themes.
2. Four KPI cards and three Live Signals segments are calculated from real user, attempt, subscription, and audit data using the definitions in this specification.
3. Search, filters, segments, sorting, and pagination are URL-backed and functional.
4. The responsive directory exposes identity, access, plan, activity, and drawer disclosure without relying on horizontal scrolling for primary actions.
5. The accessible command drawer lazy-loads Overview, Billing, Activity, and Notes data.
6. Role, tier, password reset, notes, copy, Stripe link, and CSV export behave as specified.
7. Authorization, validation, self-role protection, final-admin protection, and audit logging remain intact.
8. Designed loading, empty, partial-error, detail-error, and mutation-error states are usable.
9. Motion follows the approved choreography and respects reduced-motion preferences.
10. Relevant automated checks pass and desktop, tablet, mobile, light, and dark states are visually verified.
