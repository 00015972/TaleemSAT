# Step 10 — Public landing, support, and release truthfulness

**Implemented locally:** 13 September 2026  
**Audit item:** B10 — Ship a truthful landing page and a supportable release  
**Status:** Public-surface implementation complete locally; operator/legal and production-operations checks remain open

## What changed

The Phase 0 stack-status page has been replaced by a static public-beta landing experience based on the approved **Score Atelier** direction.

- `/` now explains the live free-beta scope and links to real signup and sign-in routes.
- The landing page advertises only category practice, accuracy analytics, daily missions, streaks, and XP as available.
- Pricing and purchase controls are absent.
- Billing and full timed mock tests appear only in a compact availability notice stating that they are not currently offered.
- Certificate, adaptive-plan, and AI-coaching claims from the historical `design/landing.html` reference are not presented as available.
- The existing `design/bahromjon.jpg` source image remains in place and is imported by the Next.js page.
- The real `public/logo.jpg` image appears in the shared public header and footer.
- `/help`, `/privacy`, and `/terms` are public static routes.
- Help directs users to `mirsoduq@gmail.com`, `https://t.me/mirik_akramov`, the password-recovery route, and question-report guidance.
- The footer includes a restrained linked “Developed by Mirsodiq Akramov” credit.

## Performance boundary

The previous public page created a cookie-scoped Supabase client, disabled revalidation, and awaited two sequential live counts before rendering. The replacement page does none of those things.

The production route manifest reports `/`, `/help`, `/privacy`, `/terms`, `/signup`, and `/forgot-password` as statically prerendered routes. A public visitor no longer waits on the subject/category count requests identified in audit performance finding P01.

## Visual and accessibility behavior

- Responsive public shell with persistent account actions.
- Desktop and tablet/mobile compositions inspected in Chrome.
- Light and dark themes inspected.
- Header and footer logo frames use consistent inset padding.
- Theme toggle uses an explicit square size and equal corner radius.
- Skill cards contain eight distinct SVG study vignettes: passage annotation, text structure, idea sequencing, grammar editing, algebra, advanced math, data analysis, and geometric construction.
- The three-step cards use asymmetric target-setting, focused-practice, and progress-dashboard scenes that carry visual weight into each card's upper-right area.
- The former circle-and-glyph skill decorations and small form-like step panels have been removed.
- Explore, Support, and Legal footer groups remain in one three-column row at tablet and mobile breakpoints.
- Decorative artwork is hidden from assistive technology.
- The tutor portrait has descriptive alternative text.
- Primary public navigation and support links are exposed with meaningful accessible names.
- Reveal behavior is progressive: server-rendered content remains present without client JavaScript.
- `prefers-reduced-motion` removes nonessential entrance, float, answer, and chart animation.

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm exec next build --webpack` | Passed; all four new public routes statically generated |
| `pnpm build` | Environment-limited: Turbopack's CSS worker could not bind an internal local port (`EPERM`); no application diagnostic was emitted |
| Source check for Supabase/dynamic count use in `app/(public)/page.tsx` | No matches |
| Browser inspection — landing | Hero, category grid, feature illustrations, tutor portrait, three-step sequence, beta notice, CTAs, and footer rendered |
| Browser inspection — illustration revision | Skill vignettes and journey scenes rendered crisply at the inspected 708px viewport; no horizontal overflow (`scrollWidth` equals viewport width) |
| Browser inspection — Help | Email, Telegram, password recovery, account, reporting, Privacy, and Terms links rendered with intended destinations |
| Theme inspection | Light and dark public surfaces rendered coherently |
| Responsive inspection | Wide desktop and narrower tablet/mobile layout checked; no visible horizontal overflow in inspected views |

The webpack production builder was used as the verification fallback because Turbopack attempted to bind an internal port that the execution environment disallowed. TypeScript, ESLint, and webpack compilation all completed successfully.

## Files

- `app/(public)/layout.tsx`
- `app/(public)/page.tsx`
- `app/(public)/help/page.tsx`
- `app/(public)/privacy/page.tsx`
- `app/(public)/terms/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `components/public/landing-art.tsx`
- `components/public/landing-skill-art.tsx`
- `components/public/landing-step-art.tsx`
- `components/public/public-article.tsx`
- `components/public/public-reveal.tsx`
- `components/public/public-shell.tsx`

## Remaining B10 release checks

This implementation does not by itself close the full release gate. Before accepting student data at scale, the release owner still needs to:

1. Review the published Privacy and Terms text with the actual operator and qualified legal guidance appropriate to the service and users.
2. Confirm that `mirsoduq@gmail.com` and `@mirik_akramov` are actively monitored support channels and define an account-data request process.
3. Re-run signup, confirmation, recovery, and email-delivery checks on the production domain in a clean browser.
4. Verify hosting and Supabase production settings.
5. Execute and record a backup restoration exercise.
6. Execute and record the deployment rollback procedure.

Until those items are evidenced, B10 is implemented locally but remains only partially closed as a production release gate.
