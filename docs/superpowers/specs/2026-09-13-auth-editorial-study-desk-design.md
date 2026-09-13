# Taleem SAT Auth Editorial Study Desk Design

**Date:** 13 September 2026  
**Status:** Approved for implementation

## Objective

Redesign `/login`, `/signup`, `/forgot-password`, and `/reset-password` so authentication feels like a deliberate part of the current Taleem SAT product rather than an older utility screen. The redesign must be eye-catching and alive while keeping every existing authentication, recovery, validation, and redirect behavior intact.

The approved direction is **Editorial Study Desk**: a warm, refined auth experience built from layered paper, answer-sheet marks, score annotations, emerald ink, antique gold, and calm, purposeful motion. The existing `public/logo.jpg` is the canonical brand mark.

## Product and Audience

The primary user is a student entering or returning to Digital SAT practice. The experience should communicate focused momentum instead of account administration. It must remain reassuring during password recovery and error states, when clarity matters more than decoration.

Success means:

- the four auth routes clearly belong to the newer Taleem SAT design system;
- the real logo, contextual illustrations, and motion create a memorable first impression;
- signup is easier to scan as a two-step flow;
- all existing auth and recovery security boundaries remain unchanged;
- desktop and mobile layouts work in both light and dark themes;
- animation never obstructs use and respects reduced-motion preferences.

## Visual Direction

### Palette and typography

The auth pages extend the site's warm cream, emerald, and antique-gold palette. Light mode resembles a sunlit paper workbench. Dark mode is designed independently as a late-night study desk with deep emerald surfaces, warm gold illumination, and readable cream text; it is not a mechanical inversion of the light theme.

Taleem SAT must continue using the existing site typography rather than introducing a disconnected auth-only font system. Manrope carries display and form copy, while small mono annotations may use the existing JetBrains Mono token. Type size, weight, and spacing provide personality without sacrificing form legibility.

### Composition

The auth route group uses a shared full-viewport shell with three layers:

1. an atmospheric background with restrained grid-paper lines, a soft radial wash, and subtle grain;
2. a compact utility header containing the Taleem SAT logo and wordmark, a link back home, and the existing theme toggle;
3. a centered auth stage that combines a contextual art panel and a functional form panel.

On desktop, the stage is an asymmetric two-column card. The art side carries a rich green or dark-emerald field with floating paper artifacts. The form side remains calm, bright, and highly legible. On narrower layouts, the art becomes a compact banner above the form. At 320 pixels wide, controls remain single-column and the page has no horizontal overflow.

The stage may grow vertically for signup, but its outer visual language and header position remain consistent across every route and state.

## Contextual Auth Artwork

Artwork is built from lightweight CSS and inline decorative SVG/markup so it loads with the auth UI and does not add a new runtime animation library. Each route has a distinct editorial vignette:

- **Login — score momentum:** a target-score note, answer bubbles, a compact progress rule, and a floating “next session” annotation.
- **Signup — set your direction:** a two-stop path labeled “Your login” and “Your direction,” with score and exam-date artifacts that become visually active as the user advances.
- **Forgot password — recovery mail:** a sealed study note following a dotted path toward a small inbox/check marker.
- **Reset password — secure restart:** a lock and answer-sheet composition that resolves into a confirmation mark.
- **Email sent / confirmation required:** the relevant mail vignette changes from transit to delivered state.
- **Invalid recovery link:** the reset vignette shows an interrupted path while the copy and request-new-link action remain primary.

All illustration containers are hidden from assistive technology. The logo uses empty alternate text when adjacent visible text already supplies the accessible brand name.

## Shared Components and Boundaries

The redesign should introduce small, focused presentation units while retaining the existing form ownership model:

- **Auth shell:** owns the route-group background, utility header, responsive stage, theme toggle, logo, and page-specific artwork slot.
- **Auth artwork:** renders the named decorative vignette from a small variant API and has no authentication or data dependency.
- **Auth panel primitives:** provide shared headings, supporting copy, alerts, field styling, password visibility buttons, progress treatment, submit buttons, and footer links.
- **Existing form components:** continue to own local input state, client validation, Supabase calls, recovery API requests, routing, and success-state selection.
- **Server pages:** continue to own metadata, safe redirect preparation, authenticated recovery checks, and invalid-link routing.

The visual refactor must not move secure decisions from the server to the client or merge all forms into one stateful component.

## Page Behavior

### Login

Login keeps email, password, password visibility, forgot-password navigation, loading protection, readable authentication errors, safe `next` redirects, and callback-error handling. The primary action reads clearly as returning to practice. Signup remains the secondary path.

### Signup

Signup becomes a two-step client flow without adding a new route:

1. **Create your login:** full name, email, and password.
2. **Set your direction:** optional target score, optional exam date, and study-reminder/marketing preference.

The progress indicator communicates “Step 1 of 2” or “Step 2 of 2” in text as well as visually. Step one validates required fields and the eight-character password minimum before advancing. Step two includes a Back action that preserves every entered value. Only the final submit calls Supabase, and double-submission protection remains in place.

If email confirmation is required, the panel transforms into the confirmation-delivered state and retains resend-verification and sign-in actions. If Supabase returns an already-registered error, the inline sign-in link remains available.

### Forgot password

The form retains its single email field, secure callback URL generation, double-submission protection, and generic retry behavior. On success, the same stage becomes a delivered-mail state containing the submitted email and a route back to sign in.

### Reset password

The valid recovery flow retains new-password and confirmation inputs, length and equality checks, loading protection, recovery API submission, and dashboard redirect. Both inputs receive password-visibility controls for consistency.

The server continues to require an authenticated user and the recovery-state cookie. Invalid, expired, or already-used links render a designed recovery-unavailable state with a prominent request-new-link action.

## Interaction and Motion

The first paint uses one short orchestrated sequence: background rules draw in, artwork rises into place, and form content reveals with a small stagger. Decorative cards have a low-amplitude idle drift; selected answer bubbles pulse once. Desktop pointer movement may create a very subtle parallax response, but the effect must remain bounded to the decorative panel.

Fields use a clear emerald/gold focus treatment with no layout shift. Password visibility is an icon button with a textual accessible name. Primary buttons have tactile hover and pressed states, a small arrow response where appropriate, and an inline loading spinner. Errors enter with a brief, low-distance shake and remain announced through `role="alert"`. Status/success copy uses `role="status"` where already appropriate.

When `prefers-reduced-motion: reduce` is active, entrance content is immediately visible, parallax and idle drift are disabled, and state changes use no positional animation. Core functionality never depends on animation or JavaScript-driven decoration.

## Theme Behavior

The header exposes the existing `ThemeToggle` on all four auth routes. Theme selection continues to use the existing root theme initialization, preventing a flash of the wrong theme.

Light and dark themes must both preserve:

- WCAG AA contrast for text and controls;
- visible focus states;
- clear field boundaries and autofill legibility;
- recognizable error, success, and disabled states;
- suitable contrast for the original logo image within its framed brand mark.

## Error and Edge Cases

- Long Supabase error messages wrap without widening or clipping the stage.
- Loading disables the relevant submit action but leaves context visible.
- Browser autofill and password managers continue to work through correct `autoComplete` attributes.
- A user can move backward in signup without losing values.
- Optional signup fields remain genuinely optional.
- The date control remains usable and legible in both themes.
- Success states provide an obvious onward or return action.
- Auth content remains usable when artwork fails or CSS animation is unavailable.
- The mobile keyboard must not hide an essential action behind a fixed viewport treatment; the shell uses document scrolling when needed.

## Accessibility and Responsive Requirements

- Preserve semantic headings, labels, links, buttons, form boundaries, alerts, and status messages.
- Every icon-only control has an accessible name and at least a comfortable touch target.
- Decorative vignettes do not appear in the accessibility tree.
- Keyboard order follows visual order and never enters purely decorative elements.
- Focus is not trapped when signup changes steps.
- Color is not the only cue for progress, errors, success, or selected state.
- `prefers-reduced-motion` removes nonessential movement.
- No horizontal overflow at 320 pixels.
- Desktop, tablet, and mobile have deliberate compositions rather than simple uniform scaling.

## Verification

Implementation is complete when:

- `pnpm lint` passes;
- `pnpm typecheck` passes;
- existing auth redirect and flow tests pass;
- `pnpm build` passes where the environment permits a production build;
- login, signup, forgot-password, valid reset-password, invalid reset-link, email-sent, and confirmation-required states render in the new shell;
- signup step validation, Back navigation, preserved values, and final submission are exercised;
- safe post-login redirect handling remains intact;
- both light and dark themes are checked at desktop and mobile widths;
- keyboard flow, visible focus, long errors, password visibility labels, browser autofill, and reduced motion are manually checked;
- no auth control or action is clipped at a 320-pixel viewport.

## Out of Scope

This redesign does not add social login, passkeys, multi-factor authentication, new password-policy rules, new database fields, additional signup questions, or changes to Supabase email templates. It does not alter authorization, account-confirmation, redirect allowlisting, recovery cookies, or session handling.
