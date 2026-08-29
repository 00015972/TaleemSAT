# Admin Questions — Operations Cockpit Design

## Purpose

Redesign `/admin/questions` and the shared admin shell as a polished, professional operations cockpit. The redesign should make the question bank feel active and responsive while preserving the speed and density required to manage a large content library.

The selected direction is **Option B: Operations Cockpit**. It was chosen from three browser mockups and approved section by section. Existing question queries, filters, bulk operations, edit routes, pagination, confirmation behavior, and theme persistence remain intact.

## Visual direction

The admin experience uses a dark, technical workspace with a restrained editorial character:

- An emerald-black foundation with layered charcoal-green surfaces.
- Bright green as the primary interaction and live-state color.
- Small gold accents for hierarchy and brand continuity.
- Crisp one-pixel borders, modest shadows, and subtle radial illumination to create depth.
- Compact Manrope-based interface typography, with question content kept highly readable.
- Dense layouts that remain calm through consistent alignment, spacing, and hierarchy.

The result should feel like a purpose-built content operations tool rather than a generic dashboard or decorative landing page.

## Shared admin shell

The existing admin header and sidebar are redesigned as one coherent frame:

- The top bar contains the Taleem SAT Admin identity, a compact question-search form, the current administrator, theme toggle, sign-out control, and route back to the student application. Submitting the search form navigates to `/admin/questions?q=<term>` and therefore reuses the existing Questions search behavior without adding an API or command-palette system.
- The sidebar uses recognizable icons, grouped navigation, and a bright green active treatment.
- Desktop navigation stays permanently visible; smaller desktop and tablet layouts reduce its footprint without hiding essential routes.
- Mobile layouts expose navigation through an accessible compact menu treatment.
- The shell remains shared across admin routes. The full question-specific cockpit content is scoped to `/admin/questions`; other routes continue to render without functional changes inside the updated frame.

## Questions workspace

### Header

The page header contains:

- A small live-content operations eyebrow.
- A strong “Questions” title.
- The total question count and a concise description of the workspace.
- A prominent `Create question` action linking to `/admin/questions/new`.

### Inventory overview

Four compact metrics summarize the question inventory:

1. Total inventory.
2. Published questions.
3. Draft queue.
4. Archived questions.

These values are derived from the question data already available to the page or from explicit count-only queries. They are presentational and introduce no new persistence. Counts must remain accurate when filters or pagination are active: global inventory metrics use global count queries, while the table count continues to describe the filtered result set.

### Filter and search controls

The existing controls remain available:

- Search by question text or College Board source ID.
- Subject.
- Category.
- Skill/topic.
- Difficulty.
- Status.

Search remains explicit on Enter to preserve the current behavior. Select filters continue to apply immediately. Changing a subject resets category and topic; changing a category resets topic. Active filters display a compact count, and a reset action clears all filters. Controls may scroll horizontally at constrained widths instead of becoming unusably narrow.

### Question ledger

The primary desktop view remains a semantic table for fast scanning and keyboard navigation. Each row contains:

- Selection checkbox.
- Source reference ID.
- Question preview.
- Skill or category metadata placed close to the question preview.
- Subject.
- Difficulty.
- Status.
- A compact, descriptively labelled edit action linking to the existing edit route.

Question preview text stays readable and visually dominant. Status and difficulty remain text-labelled and do not rely on color alone. Hover and focus states illuminate a row without moving surrounding content.

At narrow widths, the ledger becomes structured row cards. Every important field remains visible with its own label; no subject, difficulty, status, or edit information is silently removed.

### Bulk actions

Selecting rows reveals an animated bulk-action tray. It shows the number selected and preserves the existing Publish, Archive, Delete, and Clear operations.

- The tray must not shift focus unexpectedly.
- Working state disables repeat submissions.
- Delete retains its explicit browser confirmation and existing server-side skip behavior for questions referenced by attempts or exams.
- Success and failure messages use cockpit-styled alerts and remain readable by assistive technology.

### Pagination and empty state

Existing URL-based pagination remains unchanged and preserves all active filters. Disabled boundaries remain visibly disabled. An empty filtered result receives a purposeful zero-results treatment with a clear reset path, while an empty library provides a create-question action.

## Component boundaries and data flow

- `QuestionsPage` remains a server component responsible for authorization context, taxonomy options, question retrieval, global summary counts, result totals, and pagination.
- `QuestionsTable` remains the client interaction boundary for local filter state, URL navigation, selection, bulk mutations, messages, and pagination controls.
- Small presentational units may be extracted for metrics, filters, pills, empty state, and ledger rows when this makes the client component easier to understand.
- The shared admin layout owns the cockpit frame and navigation. Question-specific styling and behavior must not leak into unrelated application routes.
- Styles use a dedicated `.questions-cockpit-*` namespace plus a deliberately scoped admin-shell namespace. Existing global tokens may be reused, but unrelated selectors should not be broadly redefined.
- Existing theme state continues to control light and dark variants. The selected direction is dark-first, but light mode must remain intentionally designed rather than falling back to unstyled defaults.

## Motion

Motion is restrained and operational:

- A short orchestrated entrance for the page heading, metrics, filter strip, and ledger.
- Slightly staggered metric and initial visible-row reveals.
- A subtle live-state pulse.
- Hover illumination and icon movement for actionable rows and buttons.
- A short slide/fade entrance for the bulk-action tray.
- Smooth visual feedback when filters or selections change.

Animations should use CSS and the existing React stack. No new animation dependency is required. Motion must not block input, change layout geometry unexpectedly, or delay access to data.

All nonessential animation and transition effects are disabled under `prefers-reduced-motion: reduce`.

## Accessibility and responsive behavior

- Preserve semantic headings, navigation, tables, form labels, buttons, and links.
- Provide visible `:focus-visible` treatments using green and gold cockpit accents.
- Give icon-only actions descriptive accessible names and tooltips where helpful.
- Maintain strong text, border, and control contrast in both themes.
- Keep checkboxes associated with their row actions and preserve select-all behavior.
- Use practical 44-pixel targets for primary and mobile controls.
- At tablet widths, compact the shell and overview grid while retaining the data table where space allows.
- At mobile widths, use a compact navigation control, stacked metrics, scroll-safe filters, and labelled question cards.

## Error handling

- Preserve the current no-user and non-admin guards in the shared layout.
- Preserve safe fallbacks for null query results and counts.
- Show a clear error alert when a bulk mutation fails or returns an unusable response.
- Keep the current skipped-delete explanation and selected-state cleanup after successful bulk operations.
- Guard summary calculations against missing counts.
- Avoid hiding malformed or absent source IDs; show an em dash consistently.

## Scope exclusions

This redesign does not change:

- Database schema.
- Question creation or editing forms.
- Import pipeline behavior.
- API request/response contracts.
- Search matching semantics.
- Bulk-operation authorization or deletion rules.
- Pagination size.
- Student-facing application pages.

## Verification

- Run TypeScript type checking.
- Run ESLint against changed files, followed by the project lint command when practical.
- Verify search, every filter dependency, active-filter reset, and URL persistence.
- Verify select one, select all, clear, publish, archive, delete confirmation, successful deletion, skipped deletion, and failed mutations.
- Verify pagination with and without active filters.
- Verify long question text, absent source IDs, empty filtered results, and an empty question library.
- Verify desktop, tablet, and mobile layouts.
- Verify keyboard navigation, focus visibility, accessible labels, and status readability without color.
- Verify dark and light themes.
- Verify `prefers-reduced-motion` behavior.
- Preserve unrelated existing changes in `app/globals.css` and `app/(app)/loading.tsx` while implementing the redesign.
