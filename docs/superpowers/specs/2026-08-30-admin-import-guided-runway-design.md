# Admin Import — Guided Runway Design

## Purpose

Redesign `/admin/import-jobs/new` as a polished, professional intake experience that feels active and reassuring without changing the import pipeline. The page must retain the existing HTML-only selection, drag-and-drop behavior, upload request, server error mapping, and successful redirect to the review job.

The selected direction is **Option B: Guided Runway**. It was chosen from three browser mockups and approved in both visual and technical scope.

## Visual direction

The new page extends the existing Refined Modern Studio used by `/admin/import-jobs`:

- Poppins interface typography within the page namespace.
- Warm stone and white surfaces with Taleem SAT emerald and restrained antique-gold accents.
- A calm centered composition with generous negative space and an obvious single task.
- A soft grid or radial atmosphere that connects the route to the Imports workspace without reducing readability.
- Rounded but precise surfaces, one-pixel borders, and restrained depth suitable for an administration tool.
- An intentionally designed charcoal-based dark theme using the existing application theme state.

The memorable visual element is an emerald upload beacon with a small offset gold shadow. It floats subtly while idle and responds to drag-over without becoming playful.

## Page structure

### Header

The header contains:

- A breadcrumb back to Imports.
- A compact `New import` eyebrow.
- The title `Start a safe import`.
- Concise supporting copy explaining that questions remain private until review is complete.

### Progress rail

A centered three-step rail communicates the workflow:

1. **Upload** — active on this page.
2. **Validate** — the parser checks the defined HTML structure and flags exceptions.
3. **Review** — the administrator corrects and approves the resulting questions.

This rail is explanatory, not interactive, and introduces no new workflow state. The active step uses text, iconography, and shape rather than color alone.

### Intake card

The primary card is a large centered drop target with a quiet dashed inner boundary. It contains:

- The animated upload beacon.
- A clear file-selection instruction.
- Accepted `.html` and `.htm` format guidance.
- A primary `Browse files` action.
- A secondary drag-and-drop instruction.

The entire drop surface remains an accessible drag target. The visible button opens the hidden native file input. The card does not imply that dropping outside it is supported.

### Trust notes

Three short notes sit below the card:

- Parsed directly from the structured HTML.
- Reviewed by an administrator.
- Published only through the existing approval flow.

These replace the long prose panel with concise operational reassurance. A compact link or note still points administrators to `docs/15-html-import-schema.md` as the authoritative file contract.

## Interaction states

### Idle

The upload beacon floats by a few pixels, the card receives a short entrance reveal, and the first progress step appears active. The motion never blocks interaction.

### Dragging

The card border becomes emerald, a low-opacity green wash expands within the card, and the instruction changes to `Drop to attach this file`. The feedback is confined to the drop target.

### Invalid file

Selecting a non-HTML file leaves the page in the idle state and shows the existing `Choose a .html file.` message in an inline error banner adjacent to the intake card. The native input can immediately be used again.

### Selected

The card transforms in place into a file summary rather than adding a second competing panel. It shows:

- Filename.
- Human-readable file size.
- HTML format badge.
- `Replace file` action.
- Primary `Start import` action.

The upload beacon resolves into a file/check treatment. Selecting a replacement runs through the same validation path.

### Uploading

The selected-file layout remains stable. Both file controls are disabled, the primary action becomes `Uploading…`, and a contained indeterminate progress treatment communicates work. The existing request remains `POST /api/admin/import-jobs/html` with the selected file in `FormData`.

### Request failure

The page returns to the selected state, preserves the selected file, and shows the current mapped error copy. The administrator can retry or replace the file without starting over.

### Success

The existing redirect to `/admin/import-jobs/{jobId}` remains unchanged. No intermediate success screen is added.

## Components and boundaries

- `NewImportPage` remains the client component and owns the existing phase, dragging, error, file input, request, and redirect behavior.
- Small presentational units may be extracted in the same file when useful: `ImportProgressRail`, `ImportDropzone`, `SelectedFileSummary`, and `ImportTrustNotes`.
- The `Phase` union remains the source of truth for idle, selected, and uploading states. Dragging and error remain orthogonal state because they do not replace the selected file.
- `errorMessage` remains responsible for mapping server error codes to administrator-facing copy.
- Use icons from the already-installed `react-icons` package; add no animation or UI dependency.
- Scope all new styling under an `.import-runway-*` namespace in `app/globals.css` so other admin forms and drop zones are unaffected.
- Reuse the Refined Modern Studio color logic where practical, while keeping tokens local to the new page namespace.

No database, API, parser, route, or shared admin-shell changes are required.

## Data flow

1. The administrator chooses or drops a file.
2. `chooseFile` clears an old error, rejects names that do not end in `.html` or `.htm`, and otherwise enters the selected phase.
3. `startImport` enters the uploading phase and sends the existing `FormData` request.
4. A non-success response is mapped through `errorMessage`, restores the selected phase, and keeps the file available for retry.
5. A network failure follows the same restoration path with the existing connection error.
6. A successful response redirects to the existing import-review route using the returned `jobId`.

## Motion

Motion is restrained and operational:

- A short staggered reveal for the header, progress rail, intake card, and trust notes.
- A slow low-amplitude float for the upload beacon.
- A subtle green wash and border response during drag-over.
- A quick content transition between idle and selected states.
- An indeterminate progress sweep while uploading.
- Light button lift and icon movement on hover.

Animations use CSS only. They do not change the card's overall geometry, delay access to controls, or continue unnecessarily after selection. Under `prefers-reduced-motion: reduce`, all decorative animation is removed and state changes remain immediate.

## Accessibility and responsive behavior

- Preserve semantic headings, breadcrumb navigation, buttons, and the native file input.
- Provide visible `:focus-visible` treatments for all actions.
- Announce error and uploading status changes using an appropriate live region.
- Do not use the drop zone as the only way to select a file.
- Maintain readable contrast in both themes and never communicate progress or errors through color alone.
- Keep primary controls at least 44 pixels high on touch layouts.
- At tablet and mobile widths, reduce outer spacing while preserving the centered hierarchy.
- The progress rail remains readable on mobile through compact labels and connectors; it must not overflow horizontally.
- Long filenames wrap or truncate safely while the full value remains available through accessible text or a title.

## Error handling

Preserve all current mapped cases:

- `NOT_HTML`.
- `TOO_LARGE`, including the server-provided size limit when present.
- `NO_QUESTIONS_PARSED`, including parser detail when present.
- `UPLOAD_FAILED`, including server detail when present.
- Unknown server errors.
- Network failure.

Dropping multiple files continues to use only the first file, matching the current behavior. Empty selections do nothing. Failed uploads never discard a valid selected file.

## Scope exclusions

This redesign does not change:

- The HTML import schema.
- Parser or sanitization behavior.
- File-size limits.
- API request or response contracts.
- Review and approval behavior.
- Import history or import review pages.
- The shared admin shell.
- Authentication or authorization.

## Verification

- Run TypeScript type checking.
- Run ESLint against the changed page and then the project lint command when practical.
- Verify idle, drag-over, invalid-file, selected, replacement, uploading, retry, server-failure, network-failure, and successful redirect states.
- Verify `.html` and `.htm` selection through both the picker and drag-and-drop.
- Verify long filenames and representative small and large file sizes.
- Verify desktop, tablet, and mobile layouts.
- Verify light and dark themes.
- Verify keyboard navigation, visible focus, live status announcements, and touch target sizing.
- Verify `prefers-reduced-motion` behavior.
- Preserve unrelated existing changes in `app/globals.css`, `app/(app)/loading.tsx`, and other dirty worktree files while implementing the redesign.
