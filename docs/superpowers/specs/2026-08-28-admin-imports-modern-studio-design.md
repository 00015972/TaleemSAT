# Admin Imports — Refined Modern Studio Design

## Purpose

Redesign `/admin/import-jobs` as a polished, professional imports workspace without changing its import, review, query, ordering, error, or navigation behavior. The page must continue to show imported filenames and expose the existing Status, Extracted, Needs review, and Started values.

## Visual direction

The selected direction is **Refined Modern Studio**: a bright, structured workspace with layered surfaces, graphic summary cards, a complete scan-friendly import ledger, and restrained motion.

- Use Poppins exclusively within the redesigned imports page.
- Keep Taleem SAT green and gold as the signature colors.
- Light mode uses an ivory/soft-stone body, white surfaces, emerald actions, and antique-gold accents.
- Dark mode uses neutral charcoal body and surfaces—not a dark-green body—with brighter green and gold accents.
- Reuse the existing application theme state and `ThemeToggle` already present in the admin header.
- Add subtle atmosphere with a low-contrast grid, a soft gold glow, dimensional borders, and restrained shadows.

## Page structure

### Header

The page header contains:

- A small “Content workspace” eyebrow.
- A large “Imports” title and concise explanatory copy.
- The existing `Import HTML` link, restyled as the primary green action and paired with an upload icon.

### Summary cards

Display three presentational summaries derived from the already-fetched rows:

1. **Library readiness** — successful extractions divided by total questions, with a thin green-to-gold progress bar.
2. **Source files** — number of imports currently displayed.
3. **Needs review** — sum of failed counts across displayed imports.

These summaries do not introduce new persistence, requests, or actions. Empty totals produce a safe readiness value without division errors.

### Import ledger

Keep the imports in newest-first order from the existing query. Each row contains:

- A file icon and the full source filename, linked to the existing review detail route.
- Existing error text beneath the filename when `job.error` is present.
- Status, rendered with the existing `StatusPill` behavior.
- Extracted count as `success_count / total_count`, plus a visual completion track.
- Needs review, showing the existing `failed_count` or an em dash.
- Started date and time from the existing `formatWhen` behavior.
- A final arrow action linked to the existing review detail route.

The desktop layout remains columnar with explicit headers: File, Status, Extracted, Needs review, and Started. At smaller widths, rows become stacked cards with field labels so no information disappears.

### Empty state

Preserve the empty-state branch and existing `Import HTML` destination. Restyle it as a centered studio card with a file/upload illustration, clear text, and the primary action.

## Components and dependencies

- Keep `ImportJobsPage` as a server component.
- Keep the current Supabase admin client query unchanged.
- Keep `StatusPill` unchanged.
- Use the already-installed `react-icons` package for file, upload, alert, arrow, and summary icons.
- Scope all new styles under `.imports-studio-*` classes in `app/globals.css` to avoid changing other admin screens.
- Use the existing CSS theme tokens and `[data-theme='dark']` overrides.
- Load Poppins once through the global font import, but apply it only to the redesigned page namespace.

## Data flow and behavior

1. The server page performs the existing `import_jobs` select, order, and limit query.
2. `jobs ?? []` remains the source of truth for the page.
3. Summary values are calculated in memory from those rows for display only.
4. Import and review links keep their existing destinations.
5. The existing global theme toggle controls the page through `data-theme` and persisted local storage.

No mutations, database schema changes, new API calls, new filters, or changes to import/review behavior are in scope.

## Motion and accessibility

- Use a short page-load reveal for the header, summary cards, and ledger rows.
- Add light hover elevation and arrow movement on interactive rows/actions.
- Respect `prefers-reduced-motion: reduce` by disabling nonessential transitions and keyframes.
- Preserve visible focus states, semantic table markup on desktop, link labels, readable contrast, and tabular numerals.
- Do not rely on color alone for status or review meaning; keep text and icons.

## Error handling

- Preserve the current null-job fallback.
- Preserve each job's current error message and show it in a distinct alert treatment beneath the filename.
- Guard readiness calculations when total question count is zero.
- Long filenames truncate visually where necessary but remain available through the linked text and browser title.

## Verification

- Run TypeScript type checking and lint the changed page.
- Verify the imports page at desktop and mobile widths.
- Verify light and dark themes using the existing theme toggle.
- Verify long filenames, rows with and without review counts, error rows, the empty state, and reduced-motion behavior.
- Confirm all import and review links retain their current URLs.
