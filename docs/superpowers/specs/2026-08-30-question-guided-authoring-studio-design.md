# Question Guided Authoring Studio Design

## Purpose

Redesign the shared question form used by `/admin/questions/new` and `/admin/questions/[id]/edit` as a polished, professional authoring workspace. The experience should feel active and eye-catching without distracting administrators from accurate content entry.

The selected direction is **Option A: Guided Authoring Studio**. It was chosen from three browser mockups, then approved in layout, motion, and technical scope.

This is a presentation and interaction redesign. It preserves the current question fields, validation rules, request payloads, API routes, database schema, create redirect, edit behavior, and real student-card preview.

## Visual direction

The studio extends the current TaleemSAT admin identity:

- Warm ivory and softly tinted stone backgrounds.
- Deep TaleemSAT emerald for structure and primary actions.
- Restrained antique gold for progress, answer-key emphasis, and small moments of completion.
- White or near-white working surfaces with precise one-pixel borders and controlled depth.
- A characterful serif for page and stage titles paired with the existing admin interface type for controls and body copy.
- Subtle atmospheric gradients or texture behind the workspace, never behind form text.
- An intentionally designed dark theme using the same semantic hierarchy rather than merely inverting colors.

The memorable element is the vertical emerald authoring rail. Its gold active marker and filling connector make progress immediately understandable while visually connecting the editor and the student preview.

## Page composition

Both create and edit routes use the same studio shell.

### Route header

The compact route header contains:

- A breadcrumb back to Questions.
- `Create a question` or `Edit question` as the route-specific title.
- A concise description on the create route.
- The existing status badge on the edit route.
- A quiet unsaved/saving state when useful, without implying persistence before a successful request.

The header, rail, editor, and preview enter in one short staggered sequence.

### Three-column desktop workspace

At wide desktop sizes, the main workspace contains:

1. A narrow authoring progress rail.
2. A focused editor card for the active stage.
3. A sticky student preview.

The editor receives the largest share of interactive space. The preview remains wide enough to accurately reuse the real `.prx-*` student card presentation. The workspace stays within the admin content area and does not modify the shared navigation shell.

### Authoring progress rail

The rail contains four stages:

1. **Foundation** — subject, category, difficulty, tags, and question type.
2. **Prompt** — optional passage and question text.
3. **Answer** — multiple-choice options and key or grid-in accepted answers, followed by the required explanation.
4. **Review** — a validation summary, final student preview access, and draft/publish actions.

The active stage uses a gold-filled marker, completed valid stages use a check treatment, and stages containing submitted validation errors receive a text-and-icon attention state. Color is never the only signal.

Administrators may select any stage at any time. `Back` and `Continue` provide a linear path but do not trap experienced users or discard state. Create mode starts at Foundation. Edit mode starts at the first invalid stage when one exists and otherwise starts at Foundation; all loaded values remain available across stages.

### Focused editor card

Each stage has:

- A numbered eyebrow and clear stage title.
- One sentence of contextual guidance.
- A compact completion indicator.
- Only the fields assigned to that stage.
- Back/Continue navigation as appropriate.

Inputs retain their native semantics and existing data bindings. Difficulty and question type may use polished segmented controls while preserving their current values and keyboard behavior. Category continues to depend on the selected subject and resets when the subject changes.

The answer stage switches in place between MCQ and grid-in controls. MCQ answer bubbles remain the method for selecting the correct key. Grid-in continues to accept comma-separated equivalent forms. The explanation remains required for both types.

### Student preview

The preview continues to render the real question components rather than a decorative approximation:

- `QuestionBody` for question and explanation content.
- `ChartFigure` for imported chart SVG.
- Existing table markers and sanitized table content.
- Real MCQ card styling and answer-key indication.
- `GridInInput` in disabled preview mode for grid-in questions.

The preview updates from the same in-memory form state. It is sticky on wide screens. At narrower desktop and tablet widths it may move below the editor or open in a clearly labeled drawer, whichever preserves a useful editing width. On mobile it is available through a `Preview` control and never competes side by side with the form.

## Review stage and save actions

The Review stage is the only stage containing the primary persistence actions:

- `Save as draft`.
- `Save & publish`.

Both retain their existing full-question validation and request behavior. The redesign does not introduce partial drafts, autosave, or a different publication model.

Before submission, the Review stage groups validation feedback by authoring stage. Selecting an issue moves focus to its field. After a failed validation attempt, the relevant rail stages remain marked until their fields are corrected.

During a request, both persistence actions are disabled and the selected action communicates `Saving…` or `Publishing…`. A request or network failure preserves every in-memory field and displays an actionable error banner near the review actions. A successful create or edit continues to redirect to `/admin/questions` and refresh the router.

## Components and boundaries

`components/admin/question-form.tsx` remains the shared client-side entry point so both routes preserve their current contract. It may be reorganized into focused local or adjacent components:

- `QuestionStudio` or the retained `QuestionForm` export owns form state, derived tags and accepted answers, active stage, submission state, save state, and server error.
- `QuestionStudioRail` renders navigation and stage status.
- `QuestionStage` provides the shared stage header and transition boundary.
- `FoundationStage`, `PromptStage`, `AnswerStage`, and `ReviewStage` render their assigned fields.
- `QuestionPreview` remains responsible for the real student-card rendering.
- `Field` remains the accessible label, hint, and inline-error boundary.

Exact file extraction is an implementation choice. The important boundary is that stage components receive values, errors, and callbacks; they do not duplicate save requests or validation logic.

The create and edit server pages continue to load subjects, categories, and edit initial data exactly as they do now. Route headers may adopt shared studio classes, but route data loading remains server-side.

No database, API, authentication, authorization, reading-renderer, or admin-shell changes are required. Add no animation or form dependency.

## State and data flow

1. The create or edit route loads taxonomy data and, for edit, maps the stored question into `QuestionFormInitial`.
2. The shared client component initializes the existing form, tags input, accepted-answers input, submitted flag, saving state, and server error.
3. It adds only presentational workflow state: the active authoring stage.
4. Field changes continue to update the single in-memory form state.
5. Derived tags, accepted answers, filtered categories, and validation continue to use the current memoized rules.
6. The rail derives complete/error states from the same validation result and the fields assigned to each stage.
7. The preview renders directly from the form state, so stage changes never create a second source of truth.
8. A save assembles the current payload exactly as it does today, including grid-in canonical-answer handling.
9. The existing POST or PATCH request runs against the current API route.
10. Failure preserves local state; success returns to the Questions route.

Stage navigation does not persist data. Copy must therefore say `Unsaved changes` or equivalent and must never claim that changes have been saved locally or remotely.

## Validation and error handling

Preserve every current rule from `validateQuestion`:

- Subject and category are required.
- Question text is at least 10 characters.
- A passage, when present, is at least 50 characters.
- MCQ questions require four non-empty options and an A–D correct answer.
- Grid-in questions require at least one accepted answer.
- Explanation is at least 30 characters.
- Difficulty, type, and status use their current allowed values.

Validation remains quiet during ordinary first-pass entry. After the administrator attempts to save, errors appear inline, in the Review summary, and as attention states on affected rail stages. Moving to a stage from the summary focuses the first invalid control.

The existing generic validation notice, API error extraction, fallback save failure, and network failure remain represented. A server error stays visible until a new save attempt or an intentional field correction clears it. Failed requests never reset the active stage or entered content.

## Motion

Motion is restrained, short, and operational:

- A 500–650 ms staggered page entrance for the route header, rail, editor, and preview.
- A 220–280 ms horizontal slide and crossfade when changing stages.
- A progress connector fill and small check resolve when a stage becomes complete.
- A brief highlight or crossfade only on preview content that changed.
- A gentle ring-settle animation when the correct MCQ answer changes.
- Inline errors expand without causing an abrupt full-page jump.
- Buttons and selectable controls receive subtle hover lift, active press, and focus transitions.

There is no continuous decorative animation in the working state. Motion never delays input, save, or navigation. Under `prefers-reduced-motion: reduce`, decorative entrance and transform animation is removed; state changes remain immediate and understandable.

## Responsive behavior

- Wide desktop: rail, editor, and sticky preview appear in three columns.
- Narrow desktop/tablet: the rail may become a compact horizontal stepper; preview moves below the editor or into a drawer when needed to preserve editing width.
- Mobile: stages use a compact progress header, fields stack, actions span safely, and preview opens from an explicit control.
- The layout must avoid horizontal page scrolling with long question text, tags, filenames, table content, or answer values.
- Controls maintain practical touch targets and action labels remain visible.

## Accessibility

- Represent the stage rail as labelled navigation or an ordered step list with `aria-current="step"` on the active stage.
- Use real buttons for stage navigation, segmented choices, answer-key bubbles, preview access, and save actions.
- Preserve visible `:focus-visible` styling throughout.
- Associate every field with its label, hint, and error text.
- Announce save state and server errors through appropriate live regions.
- Move focus deliberately after selecting a Review error; do not move focus merely because preview content changed.
- Use text, icons, and shape in addition to color for completion and error states.
- Maintain readable contrast in light and dark themes.
- Retain usable content and navigation when CSS animation is unavailable.

## Scope exclusions

This redesign does not add or change:

- Autosave or local-storage persistence.
- Partial/incomplete draft validation rules.
- Question fields or database columns.
- API request and response contracts.
- Validation thresholds or publication rules.
- Rich-text editing.
- Table or chart editing.
- Question import behavior.
- Questions list behavior.
- Shared admin navigation or top-bar behavior.

## Verification

- Run TypeScript checking, targeted linting, and the project lint command when practical.
- Run a production build to catch server/client and route-boundary issues.
- Verify create and edit initialization, including published, draft, and archived edit states.
- Verify all four stages retain state when navigated in any order.
- Verify subject/category cascading and category reset.
- Verify MCQ/grid-in switching, answer-key selection, accepted-answer parsing, and preview switching.
- Verify passage, tables, chart SVG, question, options, grid-in, difficulty, and explanation preview rendering.
- Verify every validation rule maps to the correct stage, inline field, and Review summary item.
- Verify save-as-draft and publish loading, success redirect, API failure, and network failure behavior.
- Verify desktop, tablet, and mobile layouts with representative short and long content.
- Verify light and dark themes.
- Verify keyboard navigation, focus order, focus transfer from Review errors, live announcements, and touch target sizing.
- Verify `prefers-reduced-motion` behavior.
- Preserve all unrelated dirty-worktree changes while implementing the redesign.
