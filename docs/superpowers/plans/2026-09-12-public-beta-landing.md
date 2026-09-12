# Public Beta Landing Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-12-public-beta-landing-design.md`  
**Audit:** B10 in `docs/launch-audit-2026-09-11.md`

## Goal

Replace the dynamic Phase 0 placeholder with the approved static Score Atelier landing experience, add a consistent public shell and Help/Privacy/Terms pages, and document the remaining operational audit boundary.

## Task 1 — Build the shared public shell

**Files:**

- Modify `app/(public)/layout.tsx`
- Create `components/public/public-shell.tsx`
- Modify `app/globals.css`

**Work:**

1. Extract a reusable public header and footer.
2. Add the real logo, anchor navigation, theme toggle, account actions, support/legal links, and the small linked developer credit.
3. Add responsive and focus-visible styles under a dedicated `.public-*` namespace.
4. Keep the shell server-rendered except for the existing theme toggle.

**Verify:** Run typecheck and inspect public navigation at desktop and mobile widths.

## Task 2 — Build the static Score Atelier landing page

**Files:**

- Replace `app/(public)/page.tsx`
- Create `components/public/landing-art.tsx`
- Create `components/public/public-reveal.tsx`
- Modify `app/globals.css`

**Work:**

1. Remove the Supabase client, sequential taxonomy counts, and `revalidate = 0` behavior.
2. Build the approved hero, proof strip, practice showcase, available-today feature composition, instructor story, how-it-works sequence, beta-scope notice, and final CTA.
3. Import and render the existing `design/bahromjon.jpg` asset without removing or replacing it.
4. Use CSS and decorative React markup for answer sheets, score/progress graphics, category illustrations, and small contextual details.
5. Add a minimal IntersectionObserver reveal component whose initial HTML remains readable without JavaScript.
6. Add reduced-motion, dark-theme, responsive, and no-overflow rules.

**Verify:** Confirm no Supabase references remain in the page; lint and typecheck.

## Task 3 — Add support and policy pages

**Files:**

- Create `components/public/public-article.tsx`
- Create `app/(public)/help/page.tsx`
- Create `app/(public)/privacy/page.tsx`
- Create `app/(public)/terms/page.tsx`
- Modify `app/globals.css`

**Work:**

1. Build a reusable editorial article layout.
2. Add direct support through `mirsoduq@gmail.com` and `https://t.me/mirik_akramov`.
3. Include sign-in, signup, password-recovery, and question-report guidance on Help.
4. Publish product-specific Privacy and Terms text following the approved scope and avoiding unreviewed legal promises.
5. Add page metadata and cross-links.

**Verify:** Check every internal route and external contact target.

## Task 4 — Make global metadata truthful

**Files:**

- Modify `app/layout.tsx`

**Work:**

1. Replace roadmap-heavy global description copy with free-beta and available-feature language.
2. Keep the existing theme bootstrap behavior unchanged.

**Verify:** Production build metadata contains no certificate, billing, mock-test, or AI-availability claim.

## Task 5 — Verify behavior and visual quality

**Files:** No planned source changes unless verification exposes a defect.

**Work:**

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm build`.
4. Start the production server and inspect `/`, `/help`, `/privacy`, and `/terms` in a browser.
5. Check desktop and narrow mobile layouts, light/dark theme, keyboard focus, reduced motion, image rendering, anchor navigation, and horizontal overflow.
6. Confirm primary links reach signup, sign-in, forgot-password, email, Telegram, Help, Privacy, and Terms.

## Task 6 — Record audit evidence

**Files:**

- Create `docs/audits/2026-09-11/step-10-public-landing-support.md`
- Modify `docs/launch-audit-2026-09-11.md`

**Work:**

1. Record implemented routes, static-rendering improvement, commands run, browser checks, and known limits.
2. Mark only the implementation portion complete.
3. Leave operator/legal review, hosted auth/production settings, backup restoration, and rollback verification explicitly open.

**Verify:** Audit wording matches the evidence and does not claim full B10 closure.

## Task 7 — Replace placeholder-like section art

**Files:**

- Modify `app/(public)/page.tsx`
- Create `components/public/landing-skill-art.tsx`
- Create `components/public/landing-step-art.tsx`
- Modify `app/globals.css`
- Modify `docs/audits/2026-09-11/step-10-public-landing-support.md`

**Work:**

1. Replace the eight circle-and-glyph skill decorations with distinct inline SVG study vignettes matching the approved content map.
2. Replace the three small form-like journey visuals with substantial asymmetric scenes positioned in each card's upper-right field.
3. Keep every illustration decorative, theme-aware, responsive, and compatible with reduced-motion preferences.
4. Preserve the existing copy, routes, landing-page order, free-beta claims, logo treatment, footer layout, and theme-toggle fix.
5. Update the audit evidence to record the approved visual refinement without overstating B10 completion.

**Verify:** Run lint, typecheck, the webpack production build, and browser checks at desktop and mobile widths in light and dark themes.
