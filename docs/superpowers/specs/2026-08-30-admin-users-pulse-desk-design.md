# Admin Users Pulse Desk Design

**Date:** 2026-08-30  
**Status:** Approved for implementation planning  
**Route:** `/admin/users`

## Summary

Redesign the admin users page as a professional user-operations workspace named **Pulse Desk**. The page must bring account support, subscription context, and learning activity into one coherent surface while retaining the established admin cockpit shell.

The redesign replaces the legacy generic toolbar and table with:

- a live operational summary;
- a richer, filterable user directory;
- a prioritized signals rail;
- a lazy-loaded user command drawer;
- purposeful, accessible motion; and
- resilient inline action feedback.

The visual direction is the approved **Option B — Pulse Desk**. The complete page uses **Manrope** for headings, body copy, controls, labels, and numeric metrics. It must not reintroduce the previous serif heading treatment.

## Goals

1. Make daily user administration faster by keeping identity, access, subscription, and learning context on one page.
2. Create a lively but professional interface whose motion explains state and hierarchy.
3. Preserve safe role and tier management, including the current self-demotion and last-admin protections.
4. Keep first paint fast by loading directory summaries first and deeper user data only when requested.
5. Work cleanly in both existing light and dark admin themes, with dark mode matching the approved mockup.

## Non-goals

- Suspending, soft-deleting, or hard-deleting accounts.
- Building a complete customer-support ticket system.
- Editing Stripe subscription state from TaleemSAT.
- Adding email campaigns, bulk user mutations, or user impersonation.
- Redesigning the shared admin navigation or unrelated admin routes.

## Visual direction

### Typography

- Use `'Manrope', ui-sans-serif, sans-serif` throughout the users workspace.
- Use weights 700–800 for the page title, KPI values, and critical labels.
- Use tabular numerals for counts, percentages, dates, and accuracy values.
- Do not use Playfair Display, Georgia, or another serif font within this route.

### Color and atmosphere

- Reuse the shared `.admin-cockpit-shell` tokens for surfaces, text, borders, green, gold, red, and shadows.
- Preserve the deep green admin atmosphere in dark mode and the neutral warm-green cockpit in light mode.
- Use gold only for plan emphasis, attention signals, and restrained highlights.
- Add depth with low-opacity radial light, a faint grid texture, layered panels, and tinted shadows. Avoid decorative gradients that compete with data.

### Layout

The desktop page has five vertical layers:

1. Page heading with `User pulse`, explanatory copy, and an `Export users` utility action.
2. Four KPI cards: total users, paid access, weekly active users, and workspace health.
3. Search plus segment, tier, role, and sort controls.
4. A two-column content area with the user directory on the left and live signals on the right.
5. Pagination and the current result range below the directory.

Selecting a user opens a right-side command drawer over the workspace. The drawer preserves the table context beneath a dimmed, lightly blurred scrim.

## Information architecture

### KPI definitions

- **Total users:** count of all rows in `users`.
- **Paid access:** users whose current tier is `pro` or `elite`. This deliberately includes manually gifted access and is not labeled as revenue.
- **Weekly active:** distinct users with at least one `attempts.created_at` value in the previous seven calendar days.
- **Needs attention:** the distinct union of:
  - users whose `subscription_status` is `past_due` or `incomplete`; and
  - paid-access users created more than 14 days ago who have no attempt in the previous 14 days.
- **Workspace health:** `100 × (paid access − needs attention) / paid access`, rounded to the nearest whole percent. Display `100%` when paid access is zero. The card also displays the needs-attention count so the percentage is not ambiguous.

### User directory row

Each row contains:

- avatar initials;
- full name and email;
- role badge;
- tier badge;
- seven-day activity visualization;
- last practice time; and
- a disclosure control for the drawer.

The row payload also carries user ID, created date, subscription status, seven-day attempt count, total attempt count, and aggregate accuracy for sorting and accessible descriptions. Low-priority details collapse at narrower widths.

### Live signals

The rail presents three actionable, derived segments:

- renewals at risk;
- paid learners with no practice for at least 14 days; and
- recent upgrades in the last seven days. This is the distinct union of active or trialing paid subscriptions created in that period and audited tier changes from `free` to `pro` or `elite` in that period.

Selecting a signal applies the matching directory segment. The panel is informational and does not perform a mutation.

### User command drawer

The drawer contains four tabs:

1. **Overview** — full name, email, ID, role, tier, target score, exam date, marketing preference, created date, and a concise learning-health summary.
2. **Billing** — subscription provider, status, tier, current-period end, cancellation state, and a Stripe customer link when available.
3. **Activity** — total attempts, accuracy, last attempt, recent attempts with question links, and certificates.
4. **Notes** — timestamped internal notes with author identity and an add-note form.

The drawer footer exposes only approved actions:

- change role;
- change tier;
- send a password-reset link;
- copy email or user ID;
- add an internal note; and
- open the Stripe customer when one exists.

Role and tier changes retain explicit confirmation when privileges or paid access are materially changed. No suspension or deletion control appears.

## Filters, segments, and sorting

Persist directory state in URL search parameters so refresh, browser navigation, and sharing retain the same view.

- `q`: name, email, or exact user ID search.
- `role`: `student` or `admin`.
- `tier`: `free`, `pro`, or `elite`.
- `segment`: `attention`, `renewal-risk`, `inactive-paid`, `recent-upgrade`, or empty.
- `sort`: `newest`, `oldest`, `recent-activity`, or `lowest-accuracy`.
- `page`: one-based page number.

Select controls apply immediately. Text search uses a short debounce and also submits on Enter. Changing any filter resets the page to one. The active segment is visible as a removable filter chip.

## Component boundaries

### Server route

`app/(admin)/admin/users/page.tsx` remains the server entry point. It validates URL parameters and fetches:

- the KPI summary;
- the current filtered, sorted user page; and
- total filtered row count.

The route passes a serializable initial payload into the client workspace.

### Query module

Add `lib/admin/users.ts` as the only server-side home for user workspace reads. It exposes narrow functions for:

- workspace summary;
- paginated directory rows; and
- one user's detail payload.

Database aggregation must happen in SQL rather than downloading unbounded attempt history into Next.js. Add two narrowly scoped, server-only SQL functions:

- `admin_users_summary()` returns the five values needed by the four KPI cards: total users, paid-access users, weekly-active users, needs-attention users, and workspace-health percentage.
- `admin_users_directory(...)` accepts the validated search, role, tier, segment, sort, offset, and limit values. It returns one page of directory summaries plus a windowed `filtered_total` value.

Both functions are backed by the existing `attempts_user_id_created_at_idx`, `users_role_idx`, `users_tier_idx`, and `subscriptions_user_id_idx` indexes. Revoke direct execution from public client roles; call them only through the server-side admin client.

### Client workspace

Refactor `components/admin/users-table.tsx` into focused users-workspace components. The parent client component owns:

- local filter input state;
- URL navigation and pending state;
- selected user ID;
- drawer opening and closing;
- detail-request caching for the current session; and
- localized mutation progress and feedback.

Presentational components own KPI cards, filters, directory rows, live signals, skeletons, empty states, and drawer sections. No component should fetch unrelated data or duplicate authorization logic.

### Detail and mutation endpoints

- `GET /api/admin/users/[id]` returns the approved drawer payload.
- The existing `PATCH /api/admin/users/[id]` remains responsible for role and tier changes and retains all current guards and audit logging.
- `POST /api/admin/users/[id]/password-reset` sends one recovery email and records a non-sensitive audit entry.
- `GET /api/admin/users/[id]/notes` returns timestamped notes.
- `POST /api/admin/users/[id]/notes` validates and stores a note, then records `user.note.create` in the audit log.

Every endpoint uses `requireAdmin()`. Responses return stable error codes that the client maps to human-readable messages.

## Data model addition

Add an `admin_user_notes` table:

- `id uuid primary key default gen_random_uuid()`;
- `user_id uuid not null references users(id) on delete cascade`;
- `author_user_id uuid references users(id) on delete set null`;
- `body text not null` with trimmed length between 1 and 2,000 characters;
- `created_at timestamptz not null default now()`; and
- an index on `(user_id, created_at desc)`.

Notes are available only through admin-authenticated server routes. The browser never receives service-role credentials. Note bodies are not copied into the audit log; the audit record stores only the note ID and target user ID.

## Data flow

1. The server validates search parameters and concurrently requests the KPI summary and directory page.
2. The page renders usable data without waiting for any drawer payload.
3. Selecting a user opens the shell immediately with a skeleton and requests `GET /api/admin/users/[id]`.
4. Successful details are cached by user ID for the lifetime of the mounted workspace.
5. A mutation disables only the affected control and shows local progress.
6. Success updates the cached detail and refreshes the server directory so KPIs and row summaries remain authoritative.
7. Failure restores the previous control value and displays a contextual message without closing the drawer.

## Motion design

- Page title, KPI cards, filters, and the first visible rows enter with a 50–80ms stagger over roughly 500–700ms.
- KPI values count up once on initial load. Later refreshes cross-fade instead of replaying the entire entrance.
- Cards lift no more than 3px on hover. Rows translate no more than 3px and show a narrow green selection rail.
- Activity bars grow once when rows enter.
- Filtered results use a short opacity-and-vertical transition while navigation is pending.
- The desktop drawer slides in over approximately 420ms with the shared `--ease` curve; the scrim fades slightly faster.
- Successful mutations use a brief check and tinted highlight. Errors use no shaking animation.
- Under `prefers-reduced-motion: reduce`, remove translations, count-ups, stagger delays, rotating decoration, and animated activity bars. Preserve immediate state changes and focus movement.

## Loading, empty, and error states

- KPI cards and directory rows have shape-matched skeletons.
- Drawer loading uses section skeletons while keeping the user identity header visible when list data is available.
- No search results shows the active filter summary plus a `Clear filters` action.
- A genuinely empty user table shows a neutral first-user state without implying an error.
- If the KPI summary request fails, render em dashes and an accessible explanation in the KPI region while retaining the directory and its controls.
- If the directory request fails, show a bounded retry panel in the directory region.
- Detail-request failure keeps the drawer open with retry and close actions.
- Mutation failures are announced through an `aria-live` region, restore optimistic UI, and retain entered note text where applicable.
- Password-reset success confirms that a recovery email was requested without exposing a generated recovery link.

## Responsive behavior

- At medium widths, KPI cards form a two-column grid and the live-signals rail moves below the directory.
- At tablet widths, hide the activity visualization and show a concise last-active value instead.
- At mobile widths, KPI cards remain two columns when space permits and become one column on narrow devices.
- The user directory becomes a stacked list with identity, role, tier, and latest activity; it must not rely on horizontal scrolling for primary actions.
- The drawer becomes a full-screen sheet with a sticky identity header, horizontally scrollable tab list, and sticky action footer.
- Existing shared mobile admin navigation remains unchanged.

## Accessibility

- Implement each selectable row with a real button or link target rather than click handling on a non-interactive table row.
- The drawer uses dialog semantics, traps focus, closes on Escape, returns focus to the originating row, and labels its close control.
- All filters have persistent labels and visible focus indicators.
- Status is never encoded by color alone; badges and signals include text.
- Activity bars have an accessible textual summary and are decorative to screen readers.
- Success and error feedback uses appropriately polite or assertive live regions.
- Light and dark themes must meet WCAG AA contrast for body text, controls, badges, and focus indicators.

## Security and authorization

- Every read and mutation remains server-side and admin-gated.
- Continue to prevent admins from changing their own role.
- Continue to prevent demotion of the final admin.
- Validate user IDs, enum values, note length, sort keys, segments, and pagination bounds on the server.
- Escape search wildcards and reject malformed query values before database access.
- Never expose Stripe secrets, service-role keys, recovery links, or raw provider payloads.
- Audit role changes, tier changes, password-reset requests, and note creation.

## Verification strategy

### Unit tests

- Search-parameter parsing and normalization.
- Workspace-health and needs-attention calculations, including zero-paid-user behavior.
- User initials, date labels, accuracy display, and activity summaries.
- Stable client error-code mapping.

### API and integration tests

- Non-admin access is rejected for every new endpoint.
- Self-role and final-admin protections still return the expected conflict codes.
- Role and tier changes write audit entries.
- Password-reset requests do not leak recovery URLs.
- Notes enforce length constraints, author attribution, ordering, and admin-only access.
- Directory filtering, segments, sorting, total count, and pagination remain consistent.

### Component and browser tests

- URL filters restore correctly after refresh and browser back/forward navigation.
- Selecting a row opens the correct drawer and a failed detail request can be retried.
- Mutations disable only their affected control, reconcile on success, and roll back on failure.
- Drawer focus trap, Escape behavior, and focus restoration work with a keyboard.
- Responsive table/list and full-screen drawer work at desktop, tablet, and mobile widths.
- Reduced-motion mode removes non-essential animation while preserving usable feedback.
- Both light and dark themes remain legible and visually coherent.

## Acceptance criteria

The redesign is complete when:

1. `/admin/users` matches the approved Pulse Desk hierarchy and uses Manrope throughout.
2. KPI values and live signals are derived from real application data under the definitions above.
3. Filters, segments, sorting, pagination, and search are URL-backed and functional.
4. User detail data is lazy-loaded into an accessible command drawer.
5. Approved role, tier, reset-link, copy, note, and Stripe actions behave as specified.
6. Existing authorization guards and audit logging remain intact.
7. Loading, empty, partial-error, request-error, and mutation-error states are designed and usable.
8. Motion follows the approved expressive-but-professional choreography and respects reduced-motion preferences.
9. Desktop, tablet, mobile, light-theme, and dark-theme views pass visual review.
10. Relevant unit, API, component, and browser tests pass.
