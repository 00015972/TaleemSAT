# Settings Mission Control — Approved Design

## Status

Approved by the user on 2026-08-29 after browser review of three visual directions. The selected direction is Option A, “Mission Control.”

## Objective

Redesign the Settings page so it feels like part of the same Focus Arcade product as the redesigned Dashboard and Question Bank. The page should turn account configuration into a visually engaging student control room while preserving the existing profile update, marketing preference, password reset, authentication, and subscription-tier behavior.

The redesign is presentational and organizational. It does not add billing, email-change, avatar-upload, or account-deletion functionality.

## Visual system

- Use the Dashboard and Question Bank’s deep forest canvas, subtle grid texture, Manrope typography, mint green, warm yellow, coral, cream, crisp borders, and tactile lower shadows.
- Theme the existing application sidebar while the Settings Mission Control root is present so the route feels continuous with the other redesigned student pages.
- Use color deliberately: mint for identity and primary actions, yellow for subscription and score-plan emphasis, and coral for small score-quest accents.
- Build the avatar, score ticket, progress treatment, plan star, and decorative shapes with CSS and small inline SVG where useful. Decorative elements remain hidden from assistive technology and add no image request.
- Keep the page energetic but calmer than the Dashboard because students need to read and edit form values accurately.

## Page structure

1. The page header uses:
   - Eyebrow: “Player headquarters”
   - Heading: “Make the plan yours.”
   - Supporting copy explaining that identity, score quest, plan, and security live here.
   - A compact account-security status pill.
2. A mint identity hero summarizes the student:
   - Initial-based avatar and full name
   - Current tier
   - A cream score-quest ticket showing target score and exam date
   - Days remaining when the exam date is in the future
   - A compact progress treatment that is decorative and must not imply a measured predicted score
3. The lower desktop layout uses a wide profile card and a narrower right rail.
4. The profile card contains full name, immutable email, target score, and exam date fields plus the primary save action and save/error feedback.
5. The right rail contains:
   - A yellow subscription card with tier-aware copy and benefits
   - A security card with the password-reset action and sent confirmation
   - A study-updates card containing the single marketing opt-in toggle

## Form and interaction behavior

- `SettingsForm` remains the client-side owner for editable profile state, saving state, errors, and password-reset state.
- The identity hero and score ticket read from the same local form state as the fields, so name, score, and exam-date edits are reflected immediately before saving.
- The marketing preference appears only once, in the right-rail study-updates card. Toggling it marks the form dirty and is persisted by the same save operation as the profile fields.
- The primary action saves all editable fields through the existing Supabase `users` update. No API contract or database change is needed.
- The save button shows a saving state, success feedback appears without moving the layout, and subsequent edits return the state to unsaved.
- Save failures produce a readable inline alert associated with the form. Entered values remain intact.
- Password reset continues to call Supabase Auth with the existing callback URL. The control has a sending state, reports a successful send, and exposes a retryable error instead of assuming success.
- The email remains disabled and is accompanied by concise explanatory text.
- The score-quest ticket updates its empty-state copy when the score, exam date, or both are missing. Past exam dates do not show a negative countdown.

## Subscription states

- Elite and Pro accounts receive a confident active-plan card with a concise list of already available benefits. The card is informational because no dedicated billing portal exists.
- Free accounts receive an aspirational card with “Upgrade coming soon” treatment matching the current disabled payment behavior. It must not link to a nonexistent checkout flow.
- Unknown tier values fall back to the free presentation rather than producing broken copy or styling.

## Components and data flow

- `SettingsPage` remains a server component responsible for authentication and loading the profile. It passes the existing user id, email, tier, and initial profile values into `SettingsForm`, plus a stable request-date value for countdown formatting.
- `SettingsForm` becomes the Mission Control page component and owns the complete visual composition so the hero summary and form controls share one source of truth.
- Define small local presentational components for the identity hero, score ticket, subscription card, security card, and preference card inside `components/settings-form.tsx`. Keep the shared form state and action handlers in the exported `SettingsForm` orchestrator.
- New styling is scoped under a route root such as `.settings-command` and the related `.app-shell:has(.settings-command)` selectors. It must not alter admin, auth, exam, or other application pages.
- Existing `Profile` values and the Supabase update shape remain the data contract.

## Responsive behavior

- Desktop displays the mint identity hero above a wide form and narrow right rail.
- Tablet keeps the hero’s score ticket alongside the student summary where space permits, then stacks the lower columns.
- Mobile uses one column, places the sidebar menu button directly to the left of the heading, moves the score ticket below the identity copy, makes the primary action full-width, and preserves comfortable input sizes.
- Long names and emails wrap or truncate safely without covering the score ticket or actions.
- Hide the otherwise empty mobile app topbar on this route using the same scoped pattern as the Dashboard and Question Bank.

## Motion and accessibility

- Use one restrained page-entry stagger across the header, hero, profile card, and right-rail cards.
- The score ticket floats very gently, the coral orb breathes, and the plan star rotates by a few degrees on hover.
- All continuous and entry motion is disabled by `prefers-reduced-motion: reduce`.
- Every input retains a visible label, meaningful focus style, and sufficient contrast.
- The marketing toggle uses a native checkbox or an equivalently accessible control with a clear checked state and keyboard support.
- Status and error feedback use appropriate live-region semantics. Color is never the only indication of state.
- Decorative art is `aria-hidden`; the hero’s profile and score information remains available as text.

## Empty and error states

- Missing full name falls back to the user’s email-derived initial and neutral “Student” copy.
- Missing target score shows “Set your score goal” and keeps the ticket visually intentional.
- Missing exam date shows “Choose your test date” without a countdown.
- A past exam date shows the formatted date and “Update test date” rather than a negative number.
- Profile load gaps continue to use the existing safe defaults.
- Profile-save and password-reset errors are separate so one action cannot overwrite the other’s feedback.

## Implementation boundaries

- Primary files are `app/(app)/settings/page.tsx`, `components/settings-form.tsx`, and the scoped Settings section of `app/globals.css`.
- Preserve the current uncommitted authentication optimization in `SettingsPage`; build on `getClaimsUser` and `getAppProfile` rather than reverting it.
- Do not change the database schema, Supabase auth callback flow, tier model, global theme preference behavior, or unrelated sidebar/navigation code.
- Do not introduce a component library, external illustration dependency, or image-generation asset for this page.
- Preserve all unrelated uncommitted work already present in the repository.

## Verification

- Run ESLint on the changed Settings files.
- Run the repository TypeScript check.
- Run a production Next.js build if the existing worktree permits it; report unrelated failures separately.
- In the authenticated browser, verify:
  - initial profile, tier, score, and date values render correctly;
  - editing each field updates the hero and saves the expected values;
  - the marketing preference persists through the same save action;
  - success and error feedback is stable and accessible;
  - password reset shows sending, success, and failure states;
  - free, Pro, Elite, missing-goal, missing-date, and past-date presentations remain coherent;
  - desktop, tablet, and mobile layouts are usable;
  - keyboard focus and reduced-motion behavior work as specified;
  - route-scoped styling does not leak to other pages.
