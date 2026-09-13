# Unified App Shell — Approved Design

## Status

Approved by the user on 2026-08-30.

## Objective

Remove the obsolete signed-in shell design instead of briefly revealing it during navigation. Make the dark Focus Arcade shell the single persistent shell for every authenticated student route, always use the TaleemSAT image logo, and keep every icon and header control correctly centered in both expanded and collapsed sidebar states.

## Current problems

- The base `.app-shell` and `.app-sb` rules still define the old light design.
- The new dark shell is applied only through route-content selectors such as `.app-shell:has(.focus-dashboard)` and `.app-shell:has(.practice-arcade)`.
- During a server navigation, the route child can temporarily be replaced by `app/(app)/loading.tsx`. The new page marker is then absent, so the shell falls back to the old light design.
- Dashboard, Question Bank, and Settings duplicate nearly identical shell overrides under separate `:has()` selectors.
- Those overrides hide `/logo.jpg` and synthesize a letter `T` with a pseudo-element.
- The collapsed sidebar is narrower than the combined logo, collapse control, gap, and horizontal padding, causing the controls in `.sb-head` to overlap.
- Icon wrappers use different widths and collapsed alignment rules, producing an uneven visual centerline.

## Chosen approach

Promote the dark Focus Arcade shell to the base authenticated app-shell styles and delete the duplicated route-specific shell overrides. Keep page-content styles scoped to their existing page classes. This removes the obsolete fallback rather than masking it with a loading veil.

The shared loading boundary will render on the same permanent dark shell and use a dark, brand-consistent skeleton. Navigation may still show a loading state when server data is pending, but it must never show the retired light shell or the prior route's visual skin.

## Sidebar logo and header

- `/public/logo.jpg` is the only sidebar logo mark in every authenticated route and sidebar state.
- Remove all shell rules that hide the image or generate a `T` pseudo-element.
- Preserve the full TaleemSAT wordmark in the expanded sidebar.
- In the collapsed desktop rail, center the logo and collapse button in separate rows inside `.sb-head`; neither may overlap the other.
- Mobile keeps the expanded drawer header with the image logo, wordmark, and close control.
- The logo retains a contained shape and visible focus behavior through its link.

## Icon alignment

Use one sidebar rail centerline for primary chips, utility icons, theme control, account avatar, and sign-out icon. Icon wrappers remain fixed-size flex containers with explicit `align-items` and `justify-content`. Collapsed links and buttons use matching horizontal padding and centering so active borders, shadows, and transforms do not visually shift an icon off center.

## CSS structure

- Base `.app-shell`, `.app-sb`, `.sb-*`, and `.app-tb` rules own the permanent dark shell.
- Dashboard, Question Bank, and Settings retain only page-specific content rules and page-specific design tokens that their content consumes.
- Delete duplicated route-specific sidebar, logo, navigation, account, and topbar override blocks.
- Keep responsive and reduced-motion behavior intact.
- Do not redesign page content, alter navigation destinations, or change application data flow.

## Loading behavior

The existing App Router loading boundary remains responsible for replacing pending page content. Its skeleton uses the permanent shell's surface, border, and text colors, fills the available content area, and has no dependency on destination-page marker classes. The sidebar remains mounted and interactive while the content region loads.

## Accessibility

- Preserve current link/button labels, `aria-current`, loading semantics, keyboard focus styles, and reduced-motion handling.
- Keep the decorative logo image hidden from assistive technology because the adjacent wordmark/link provides the accessible identity.
- Centering changes must not reduce click targets.

## Verification

- Run TypeScript checking and ESLint for changed TSX files.
- Run the production build when environment dependencies permit.
- Verify expanded and collapsed desktop sidebar geometry.
- Verify the mobile drawer header at widths below 900px.
- Navigate among Dashboard, Question Bank, Mock Test, Analytics, and Settings while at least one destination is slow enough to show the loading boundary.
- Confirm no light/old shell appears during navigation.
- Confirm `/logo.jpg` is visible on every route and no generated `T` remains.
- Confirm primary, utility, theme, account, and sign-out icons share the same visual centerline in collapsed mode.

## Out of scope

- Redesigning individual page content.
- Changing route data fetching or authentication.
- Adding a full-page loading veil or route-transition library.
- Replacing the supplied logo asset.
