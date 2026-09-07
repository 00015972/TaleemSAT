# Admin Import Review — Quality Cockpit Design

## Purpose

Redesign /admin/import-jobs/[id] as a polished two-pane quality-control workspace for reviewing questions extracted from HTML imports. The page should feel active, professional, and visually consistent with the newer TaleemSAT admin pages while making large imports substantially faster to review.

The selected direction is **Option B: Quality Cockpit**. It was chosen after comparing three browser mockups:

- Command Ledger: a refined version of the existing stacked-card layout.
- Quality Cockpit: a review queue beside a focused question inspector.
- Editorial Archive: a more decorative academic ledger.

Quality Cockpit was selected because it combines a professional visual identity with the clearest operational improvement for imports containing dozens of questions.

## Goals

- Replace the long stack of expanded question cards with a focused queue-and-inspector workflow.
- Preserve all existing import, polling, editing, rejection, selection, and approval behavior.
- Make the status of an import and the next useful review action immediately obvious.
- Reduce the amount of scrolling required to review large imports.
- Use the Poppins interface typography already established on the newer admin pages.
- Add restrained, meaningful motion that communicates selection, progress, success, and attention states.
- Work in light and dark themes and remain usable on desktop, tablet, and mobile.

## Scope

This redesign changes the review-page presentation and client-side interaction model. It does not change:

- Database tables or stored import data.
- HTML parsing, validation, or sanitization.
- Import-job or import-item API contracts.
- The meaning of existing job and item statuses.
- Authentication, authorization, or the shared admin shell.
- The behavior that approved import items become draft questions.

## Visual direction

The page uses a **refined operational cockpit** aesthetic:

- Poppins for page interface text, controls, labels, metadata, and headings.
- Source Serif 4 for imported question content and explanations where an editorial reading face improves comprehension.
- JetBrains Mono for source references and compact technical labels.
- TaleemSAT emerald as the dominant operational accent.
- Warm white and pale stone surfaces instead of cold gray or pure white.
- Antique gold only for small progress or attention details.
- Fine borders, shallow brand-tinted shadows, and precise radii.
- Dense but calm information hierarchy appropriate for an administration tool.

The memorable visual element is the inspector workspace: a stable, paper-like question canvas paired with a compact quality rail. The queue provides rhythm and orientation without competing with the current question.

## Page structure

### Import header

The top of the review route contains:

- Breadcrumb back to Imports.
- A human-readable import title derived from the source filename.
- The full source filename as secondary metadata.
- Job status.
- Extracted, ready, needs-attention, and resolved counts.
- Circular review progress treatment.
- A compact destructive menu or delete action separated from primary review actions.

The header stays concise enough that the queue and inspector remain visible above the fold on a typical desktop viewport.

### Review workspace

The desktop workspace is a two-column layout:

1. A fixed-width review queue on the left.
2. A flexible question inspector on the right.

The inspector itself contains:

1. The main question canvas.
2. A compact quality rail.

The page does not render every question body simultaneously. Only the active item receives the full preview or edit interface.

### Review queue

Each queue row contains:

- Source reference.
- Compact status.
- Truncated question preview.
- Question type and difficulty when space permits.
- A visual marker for validation problems.
- A selected state that uses shape, border, and position in addition to color.

The queue includes:

- Search scoped to the current import.
- Status filters for all, ready, attention, rejected, and approved.
- Result count.
- Select-all control for currently promotable items.
- Individual selection controls for promotable items.

Search and filtering change only which rows are visible. They never change item status, bulk selection, or the underlying imported data.

### Question inspector

The main canvas contains:

- Source reference, status, type, difficulty, and topic metadata.
- Chart or image.
- Passage when present.
- Question text.
- Multiple-choice options or accepted grid-in answers.
- Clearly marked correct answer.
- Explanation.
- Validation errors and model notes when relevant.

Preview mode prioritizes faithful display of imported content. Edit mode replaces the preview in the same canvas, preserving the active queue item and overall workspace geometry.

### Quality rail

The quality rail translates existing item data into compact operational signals:

- Answer agreement from verification_notes.answersAgree.
- Extraction confidence from verification_notes.confidence.
- Validation issue count from validation_errors.
- Model notes from verification_notes.modelNotes.
- Current review state.

Unknown or absent signals are labeled as unavailable rather than inferred. Validation errors remain visible in full and are not reduced to a count alone.

The rail contains the primary sequential action:

- Approve & next for a pending-review item.
- A resolved-state summary for approved, rejected, or already-promoted items.

Reject and edit remain available but visually secondary.

### Bulk action bar

When one or more promotable questions are selected, a floating or sticky bulk-action bar appears within the workspace. It shows:

- Selected count.
- Clear selection action.
- Approve-selected action.

The bar never obscures the active question controls and collapses immediately when selection becomes empty.

## Interaction model

### Initial selection

After items load, the workspace selects:

1. The first item needing attention, when one exists.
2. Otherwise the first pending-review item.
3. Otherwise the first available item.

If there are no items, the existing empty or in-flight state is shown.

### Queue navigation

Selecting a queue row changes only the active inspector item. It does not toggle the item's bulk-selection checkbox. Checkbox interaction and row navigation remain separate.

Keyboard shortcuts are available when focus is not inside an input, textarea, select, or content-editable element:

- J selects the next visible queue item.
- K selects the previous visible queue item.
- E enters edit mode when editing is available.
- A focuses or reveals the approve action; it does not silently approve an item.

Visible shortcut hints are included in an unobtrusive help treatment. Shortcuts never override browser or assistive-technology commands.

### Sequential approval

Approving the current item:

1. Disables only approval controls affected by that request.
2. Sends the existing promote request.
3. Shows a brief success confirmation.
4. Refreshes job and item data.
5. Selects the next unresolved item in the current visible queue.

If no unresolved visible item remains, the workspace selects the next available row and communicates that the filtered queue is complete.

A failed approval preserves the current selection, does not advance the queue, and displays the returned detail.

### Rejection

Rejecting an item uses the existing item update request. A successful rejection updates the queue state and advances to the next unresolved item. A failure leaves the item active and displays an error.

### Editing

Edit mode uses the existing editable fields:

- Question text.
- Multiple-choice options and correct answer.
- Accepted grid-in answers.
- Explanation.

Saving keeps the item selected and returns to preview mode after a successful refresh. Canceling discards unsaved local changes and restores the current server-backed values. Failed saves preserve the draft and keep edit mode open.

### Polling

Queued and running jobs continue polling every three seconds. Refreshes preserve:

- Active item when it still exists.
- Bulk selections that remain promotable.
- Current search and filters.
- Edit mode and unsaved draft for the active item.

If the active item disappears, the selection falls forward to the next visible item, then backward, then to the initial-selection rule.

## Motion

Motion is restrained and state-driven:

- Short staggered entrance for the header, queue, inspector, and quality rail.
- A small crossfade and horizontal shift when changing the active item.
- A subtle emerald confirmation pulse after successful approval.
- A restrained amber attention treatment for validation issues.
- Animated review-progress updates.
- Small lift and border response on queue-row and button hover.
- A spring-like slide for the bulk-action bar.
- A contained skeleton or shimmer while an in-flight import has not produced viewable items.

Animations use CSS where practical and do not require a new animation dependency. Motion must not delay access to controls, move large distances, or run continuously without communicating an active state.

Under prefers-reduced-motion: reduce, decorative entrance, float, pulse, and slide effects are removed. State changes remain immediate and comprehensible.

## Component boundaries

ImportReview remains the client-side owner of server interaction and top-level workspace state. It coordinates smaller components with clear responsibilities:

- ImportReviewHeader: job identity, counts, progress, and import-level actions.
- ReviewQueue: search, filters, visible rows, active-item selection, and bulk-selection controls.
- ReviewQueueItem: compact item summary and independent checkbox interaction.
- QuestionInspector: preview/edit switching and active-item presentation.
- QuestionPreview: faithful rendering of imported question content.
- QuestionEditor: local draft fields, save, and cancel.
- QualityRail: validation and verification signals plus sequential actions.
- BulkActionBar: selection count, clear, and approve-selected behavior.

These may remain in components/admin/import-review.tsx if the file stays easy to understand. If the redesign makes the file unwieldy, presentational units should move into focused files under components/admin/import-review/. Server requests and state transitions remain centralized rather than being duplicated across visual components.

## State model

Top-level client state includes:

- Latest job.
- Latest items.
- activeItemId.
- Bulk-selected item IDs.
- Queue search text.
- Queue status filter.
- Request state scoped by operation.
- Page-level success or error message.

Edit draft state belongs to the active editor. It is initialized from the selected item when entering edit mode, not on every polling refresh.

Derived values include:

- Promotable items.
- Visible queue items.
- Ready count.
- Needs-attention count.
- Resolved count.
- Review percentage.
- Next unresolved visible item.

Derived values are computed from the latest item array rather than stored independently.

## Data flow

1. The server route loads the import job and ordered import items.
2. ImportReview initializes the queue and selects the most useful first item.
3. Queue search and filters derive a visible item list locally.
4. Selecting a row updates activeItemId.
5. The active item is passed to the inspector and quality rail.
6. Save, reject, approve, and bulk-approve actions reuse the existing endpoints.
7. Successful mutations refresh job and item data.
8. Reconciliation preserves valid selection and advances only after successful sequential actions.
9. The route refreshes after promotion so server-rendered counts outside the component remain current.

## Error and status handling

- Job-level extraction errors use a persistent alert near the import header.
- Refresh failures show a non-blocking stale-data message and retain the last successful data.
- Save, reject, and approval failures appear beside the relevant action and in the page live region.
- Network failures use concise retry-oriented copy.
- Validation errors remain attached to the affected item.
- Empty filtered queues show a clear reset-filters action.
- Completely empty imports retain the existing reading/empty distinction.
- Disabled controls explain their state through adjacent text or accessible descriptions when the reason is not obvious.

One failed operation never disables unrelated navigation or review actions.

## Responsive behavior

### Desktop

- Persistent queue and inspector.
- Quality rail beside the question canvas.
- The workspace targets full use of the available admin-main width and viewport height.

### Tablet

- Narrower persistent queue when space allows.
- Quality rail moves below the main question content before the queue becomes unusably narrow.
- Header metrics condense into fewer columns.

### Mobile

- Single-column inspector.
- Queue opens as an accessible slide-over or sheet from a clear Questions control.
- Current position and unresolved count remain visible in the inspector header.
- Quality signals appear below question content.
- Bulk action bar becomes full-width and respects safe-area insets.
- All primary controls meet a minimum 44-pixel touch target.

## Accessibility

- Use semantic buttons, headings, lists, forms, and status regions.
- Keep checkbox and queue-row activation as separate controls.
- Provide visible :focus-visible treatments on every interactive element.
- Announce mutation progress, success, failure, and automatic advancement with a polite live region.
- Move focus predictably after queue-sheet close and after entering or leaving edit mode.
- Do not move keyboard focus automatically on polling refresh.
- Use text and iconography in addition to color for status.
- Maintain readable contrast in both themes.
- Give charts and imported images appropriate existing accessible treatment.
- Ensure scrollable queue and inspector regions are reachable and understandable by keyboard.

## Styling boundaries

- Scope new page styling under an .import-cockpit-* namespace in app/globals.css.
- Reuse shared TaleemSAT tokens where they match the selected direction.
- Add local cockpit tokens only for page-specific sizing and surfaces.
- Do not change global question rendering styles unless required for correctness.
- Preserve the shared admin shell and its current responsive behavior.
- Use the already-installed icon library; add no UI or animation dependency.

## Verification

### Functional

- Initial item selection follows the attention, pending, fallback order.
- Queue search and every status filter return the expected visible items.
- Row selection does not toggle bulk selection.
- Select-all affects only promotable items in the intended scope.
- Active selection survives refresh when possible.
- Sequential approve and reject advance only after success.
- Failed mutations preserve selection and editable data.
- Editing, saving, and canceling behave correctly for MCQ and grid-in items.
- Bulk approval reports promoted and skipped items correctly.
- Polling continues only while the job is queued or running.
- Empty, filtered-empty, running, completed, error, rejected, and promoted states render correctly.

### Visual

- Desktop queue, canvas, and quality rail remain usable at representative viewport heights.
- Long filenames, source references, topics, question text, explanations, and options wrap safely.
- Charts, tables, passages, and grid-in answers fit the inspector.
- Light and dark themes preserve hierarchy and contrast.
- Tablet and mobile transformations avoid horizontal overflow.
- Entrance, selection, attention, success, progress, and bulk-bar motion behave as specified.
- Reduced-motion mode removes decorative animation.

### Code quality

- Run TypeScript type checking.
- Run ESLint on changed files and the project lint command when practical.
- Keep API and database contracts unchanged.
- Avoid new runtime dependencies.
- Preserve unrelated worktree changes.

## Acceptance criteria

The redesign is complete when an administrator can open a large HTML import, understand its overall state, move through questions from a compact queue, inspect quality signals, edit or reject exceptions, approve valid questions sequentially or in bulk, and always understand what happened after an action—without relying on a long stack of expanded cards.
