# Authenticated Light Theme — Approved Design

## Status

Approved by the user on 2026-09-13.

## Objective

Make the existing theme toggle visibly switch the complete authenticated student experience between light and dark themes. Light mode must include the sidebar, mobile topbar, loading state, Dashboard, Question Bank, Settings, Analytics, and generic signed-in pages. Preserve the current dark-mode appearance and the distinct visual identity of each page.

## Current problem

The toggle already updates `<html data-theme>` and persists the selection in `localStorage`. Global semantic tokens also provide working light and dark values. However, the authenticated shell and four redesigned student pages define independent dark-only palettes and numerous hardcoded dark surfaces and light text colors. Those scoped rules bypass the global tokens, so the theme state changes while most visible UI remains dark.

## Chosen approach

Keep the existing theme state, initialization script, and persistence behavior. Add explicit light-mode values for the scoped shell and page palettes, then replace hardcoded palette-dependent colors in those sections with local semantic variables.

This targeted token approach preserves the character of Focus Arcade, Practice Arcade, Mission Control, and Score Observatory. It avoids a broad refactor that would flatten their page-specific palettes, and it avoids incomplete background-only overrides that would leave contrast defects.

## Visual system

### Light mode

- Use the established warm cream canvas, paper-white surfaces, dark forest text, emerald actions, antique-gold accents, and restrained coral highlights.
- Retain the subtle checker texture, radial atmosphere, tactile lower shadows, illustrated cards, and current typography.
- Render the sidebar as a light paper or cream rail with dark emerald text, readable muted labels, visible borders, and the existing green/gold navigation accents.
- Keep colorful feature cards intentional; mint, yellow, coral, and cream cards may remain saturated where their text contrast is appropriate.

### Dark mode

- Preserve the current deep-forest shell and page palettes without visual redesign.
- Continue using mint, yellow, coral, and cream as the principal accents.

## CSS architecture

- The global `data-theme` attribute remains the only theme source of truth.
- The authenticated shell exposes semantic local variables for canvas, sidebar, panels, text, muted text, borders, hover states, active states, and shadows.
- Dashboard, Question Bank, Settings, and Analytics retain their namespaces and expose equivalent local variables for palette-dependent surfaces and typography.
- Light values apply when `data-theme='light'`; current dark values remain the dark-mode defaults or explicit dark overrides.
- Palette-dependent literal colors inside the affected namespaces are replaced with their nearest local semantic variable. Intentionally theme-independent decorative colors remain literal.
- The mobile topbar and route-loading skeleton consume the same shell tokens so navigation cannot flash the wrong theme.
- Admin, public, authentication, exam-runner, and Supabase behavior remain outside this change unless they already consume the shared global theme correctly.

## Components and data flow

- `ThemeToggle` continues to set `data-theme` synchronously and write `taleem_theme` to `localStorage`.
- The root layout initialization script continues to restore the saved theme before first paint and otherwise follows the operating-system preference.
- No React state contract, route data, Supabase query, or application API changes are required.
- CSS custom-property inheritance updates mounted pages immediately after the root attribute changes.

## Interaction and persistence

- Clicking Appearance switches the shell and current page in the same frame.
- The icon and accessible label continue to describe the opposite theme action.
- The selected theme persists across reloads and signed-in route navigation.
- A first-time visitor without a saved preference continues to inherit the operating-system color preference.

## Accessibility

- Text, controls, borders, and focus indicators must remain readable on every light and dark surface.
- Active, hover, disabled, and error states must not depend on color alone.
- Native inputs in Settings must use a matching `color-scheme` so browser-provided controls are legible in both modes.
- Existing reduced-motion behavior, accessible labels, keyboard navigation, and semantic structure remain unchanged.

## Verification

- Run ESLint and the repository TypeScript check.
- Run the production build when environment dependencies permit.
- Verify immediate theme switching on Dashboard, Question Bank, Mock Test, Analytics, and Settings.
- Verify the expanded and collapsed desktop sidebar, mobile drawer, mobile topbar, and route-loading state in both themes.
- Reload each theme and confirm that the saved choice is restored before paint.
- Check representative text, controls, forms, cards, charts, hover states, focus states, disabled states, and errors for contrast.
- Confirm that dark mode remains visually unchanged and that public, auth, admin, and exam surfaces do not regress.

## Scope boundaries

- Do not change authentication, profile data, Supabase configuration, navigation, route behavior, or page content.
- Do not introduce a component library, image asset, database migration, or new persistence key.
- Do not redesign page layouts or replace the existing Focus Arcade family of visual systems.
- Preserve all unrelated uncommitted work in the repository.
