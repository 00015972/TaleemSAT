# Auth Editorial Study Desk Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-13-auth-editorial-study-desk-design.md`

## Goal

Replace the legacy auth cards with the approved responsive Editorial Study Desk experience while preserving every existing login, signup, verification, recovery, and safe-redirect behavior.

## Task 1 — Build the shared auth stage

**Files:**

- Modify `app/(auth)/layout.tsx`
- Create `components/auth/auth-shell.tsx`
- Create `components/auth/auth-art.tsx`
- Create `components/auth/auth-ui.tsx`
- Modify `app/globals.css`

**Work:**

1. Add the real logo, home link, theme toggle, atmospheric background, and responsive two-panel stage.
2. Create page/state-specific decorative art variants with CSS and semantic-free SVG/markup.
3. Add reusable panel headings, fields, alerts, password controls, actions, and success-state treatment.
4. Namespace styles under `.auth-*`, including light/dark themes, focus-visible states, mobile layouts, and reduced motion.

**Verify:** Render representative shell and artwork variants without changing auth behavior.

## Task 2 — Redesign login and password recovery

**Files:**

- Modify `components/auth/login-form.tsx`
- Modify `components/auth/forgot-password-form.tsx`
- Modify `components/auth/reset-password-form.tsx`
- Modify `app/(auth)/reset-password/page.tsx`

**Work:**

1. Move each state into the shared panel and select the correct illustration.
2. Preserve safe login redirects, callback errors, recovery callback generation, recovery API submission, and invalid-link checks.
3. Add accessible password visibility buttons to reset fields.
4. Restyle loading, inline errors, sent-mail, and invalid-link states.

**Verify:** Exercise login error, forgot sent state, valid reset validation, and invalid reset-link rendering.

## Task 3 — Convert signup into two steps

**Files:**

- Modify `components/auth/signup-form.tsx`
- Modify `components/resend-verification-button.tsx`

**Work:**

1. Split account credentials and optional study direction into two views within the same component.
2. Validate step-one fields before advancing, preserve values when moving backward, and submit only from step two.
3. Add accessible textual and visual progress.
4. Preserve confirmation-required, resend-verification, already-registered, loading, and direct-session outcomes.

**Verify:** Check forward/back navigation, field persistence, validation, and final submit protection.

## Task 4 — Verify quality and behavior

**Files:** No planned source changes unless checks expose a defect.

**Work:**

1. Run auth/redirect tests, lint, typecheck, and production build.
2. Inspect login, signup steps, forgot-password, reset invalid-link, and success-state code paths in a browser.
3. Check desktop and 320-pixel layouts in light/dark themes.
4. Check keyboard order, visible focus, long error wrapping, reduced motion, and horizontal overflow.

**Verify:** All automated checks pass and each route/state retains its original functional contract.
