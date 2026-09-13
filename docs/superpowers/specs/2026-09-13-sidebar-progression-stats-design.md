# Sidebar Progression Stats — Approved Design

## Status

Approved by the user on 2026-09-13, with the explicit requirement that UI icons come from `react-icons` rather than emoji.

## Objective

Show each signed-in student's current day streak and lifetime XP in the shared `app-sb` sidebar on every authenticated app page.

## Interface design

Add a compact two-chip stats row immediately below the primary navigation and before the divider that separates account utilities. The first chip uses correct singular and plural copy, such as `1 day` or `7 days`; the second shows lifetime XP, such as `1,240 XP`. Values use locale-aware number formatting where appropriate.

Use outlined icons from the project's existing `react-icons` dependency: `FiZap` for the streak and `FiAward` for XP. Icons are decorative and receive `aria-hidden="true"`; the enclosing stats region exposes a concise accessible label containing both full values. No emoji are used.

The chips use the existing dark sidebar palette, yellow accent for streak, green accent for XP, compact spacing, and the same corner radius and line weight as nearby navigation controls. The presentation stays intentionally secondary to navigation.

## Responsive and collapsed behavior

- Expanded desktop: show both chips side by side.
- Collapsed desktop: hide the stats row, matching the existing icon-only rail behavior and avoiding ambiguous unlabeled icons.
- Mobile drawer: show both chips side by side even if the persisted desktop collapse preference is enabled.
- Long values must remain contained without widening the sidebar; use compact locale formatting and resilient flex sizing.

## Data flow

Extend the existing cached `getAppProfile()` query to select `current_streak` and `total_xp` with the profile fields already read by the authenticated app layout. Pass zero-safe numeric values through `AppShellUser` to `AppSidebar`; do not add a client-side fetch or a second database round trip.

The sidebar displays the persisted current streak value supplied by the profile. Existing progression database logic remains authoritative for awarding XP and maintaining streak state. The sidebar is read-only and creates no progression events.

## Error and empty states

Missing, null, or malformed values resolve to zero before reaching the sidebar. New students therefore see `0 days` and `0 XP`. A profile read failure must not prevent the app shell from rendering its existing identity fallback behavior.

## Scope

This change does not alter XP awards, streak rules, dashboard progression cards, navigation, sidebar collapse persistence, or progression refresh behavior after an answer is submitted. It only exposes the authoritative profile totals already maintained by the application.

## Verification

- Type-check and lint the touched files.
- Confirm singular and plural streak labels (`1 day`, otherwise `days`).
- Confirm zero values render safely.
- Confirm expanded desktop, collapsed desktop, and mobile drawer behavior.
- Confirm both icons come from `react-icons` and no emoji are rendered.
- Confirm the app layout still performs a single cached profile read rather than adding another progression request.

## Alternatives considered

### Stacked cards

More room for labels but consumes unnecessary vertical space in the navigation rail.

### Stats beside the account footer

Keeps navigation sparse but makes progression less discoverable and crowds account actions.

### Selected: compact pair beneath primary navigation

This placement is immediately visible, preserves the existing navigation hierarchy, matches dormant sidebar styling already present in the codebase, and requires the smallest focused change.
