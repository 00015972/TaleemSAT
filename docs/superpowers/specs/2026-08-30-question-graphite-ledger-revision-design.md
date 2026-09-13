# Question Studio Graphite Ledger Revision Design

## Purpose

Correct the visual direction of the shared create/edit Question Guided Authoring Studio after reviewing the implemented page in an authenticated browser.

The four-stage workflow remains approved. This revision replaces the studio's mismatched serif typography, saturated mint actions, green-filled panels, and legacy `.prx-*` question card with **Option B: Graphite Ledger**.

The revision applies to both `/admin/questions/new` and `/admin/questions/[id]/edit` because they share `components/admin/question-form.tsx`.

## Relationship to the original design

This document supersedes the visual-system and preview-presentation portions of `docs/superpowers/specs/2026-08-30-question-guided-authoring-studio-design.md`.

The following approved behavior remains unchanged:

- Foundation, Prompt, Answer, and Review stages.
- Direct stage navigation and Back/Continue controls.
- Shared create/edit state and props.
- Subject/category cascading.
- MCQ and grid-in editing behavior.
- Validation rules and review-stage issue navigation.
- Draft/publish requests and redirects.
- Desktop preview placement and responsive preview disclosure.
- Error recovery, accessibility, and reduced-motion support.

## Typography

Use **Manrope** throughout the studio:

- Route title and supporting copy.
- Stage titles and descriptions.
- Progress navigation.
- Field labels, controls, hints, and errors.
- Buttons and save actions.
- Preview metadata, question content, answer content, and explanation.

Hierarchy comes from size, weight, spacing, and contrast rather than a second display family. Remove all `var(--serif)`, `var(--serif-read)`, Poppins, and monospace font assignments within the `.question-studio-*` namespace. Compact uppercase labels may retain letter spacing but still use Manrope.

This matches the newer admin cockpit and Bluebook Air practice-runner typography.

## Graphite Ledger palette

### Dark mode

Dark mode uses neutral graphite rather than emerald-black blocks:

- Page canvas near `#121416`.
- Main panels near `#202327`.
- Raised preview surface near `#262a2e`.
- Inputs and recessed areas near `#191c20`.
- Primary borders near `#33383d`, with stronger interactive borders near `#454b51`.
- Primary text near `#f1f2f2`.
- Secondary text near `#b9bdc1`.
- Muted text near `#7e858b`.

Antique gold is limited to small progress, stage, and metadata accents. Green is limited to semantic states such as live synchronization, valid completion, and the correct answer. No large studio surface uses green as its background.

### Light mode

Light mode uses cool neutral whites and grays:

- A soft gray page canvas.
- White or near-white panels.
- Slightly tinted recessed controls and preview answer rows.
- Neutral gray borders and shadows.
- Near-black primary text and cool gray secondary text.

Gold and green follow the same restrained semantic roles as dark mode. Light mode must feel like the same Graphite Ledger system, not a separate emerald theme.

## Page and stage surfaces

- Replace the green authoring rail with a neutral graphite progress surface.
- Keep the horizontal desktop stepper created by the current responsive layout, but use quiet neutral active states with a thin gold marker rather than a large green or glowing fill.
- Main editor and preview panels use the same neutral surface family and one-pixel borders.
- Remove decorative green radial washes, green circular ornaments, and strong green shadows from the studio.
- Reduce the visual weight of the route icon or remove its filled green treatment.
- Keep depth modest: one soft panel shadow and small control elevation are sufficient.

The workflow remains visually active through precise transitions, progress movement, and hover/focus feedback rather than saturated color blocks.

## Buttons and selectable controls

Primary stage and publish actions use muted charcoal or graphite-blue surfaces, readable light text, a restrained border, and shallow pressed depth.

- Do not use bright mint or luminous green fills.
- Do not use large green glows.
- A hover may raise the control by one or two pixels and slightly strengthen its border.
- The pressed state reduces the lower shadow and returns the control toward the canvas.
- Secondary actions stay neutral and outlined.
- Selected difficulty and question-type controls use a neutral raised state with a small gold or cool-gray indicator.
- Green remains available for completed checks and the correct answer, not ordinary selection.

Disabled and loading states remain readable and do not collapse the button geometry.

## Modern assessment preview

Replace the legacy preview presentation entirely. The new preview must not use these legacy structural classes:

- `.prx-card`.
- `.prx-opt` and related legacy bubble/flag classes.
- `.prx-expl`.
- The legacy `.prx-gridin` preview shell.

### Preview frame

The preview panel contains:

- A compact header with a modern rectangular question badge.
- `Student preview` title and concise assessment-workspace label.
- Restrained live and difficulty indicators.
- A neutral raised assessment canvas inside the panel.

### Question content

The assessment canvas renders, in order:

1. Optional passage.
2. Sanitized chart SVG.
3. Question text and sanitized table markers.
4. MCQ answer rows or a disabled grid-in preview field.
5. Explanation.

`QuestionBody` remains the renderer for question text and explanation so sanitized rich content and tables remain supported. `ChartFigure` remains responsible for sanitized SVG output. The studio applies dedicated preview classes around and within those renderers to produce the modern presentation.

### MCQ preview

- Answer rows are neutral rectangular surfaces with practical padding and quiet borders.
- Answer letters use compact rounded-square markers rather than the legacy pencil bubbles.
- The correct answer receives a restrained green border/check state.
- Placeholder answers use the same geometry with muted text.
- Question and answer typography uses Manrope.

### Grid-in preview

- Render a dedicated disabled input-like surface rather than mounting the legacy `GridInInput` preview component.
- Include concise accepted-format guidance.
- Use the same neutral control geometry as the studio and recent practice runner.

### Explanation

- Use a neutral inset panel with a small gold metadata label.
- Explanation text uses Manrope and the same readable line-height as question content.
- Empty explanation copy remains visibly provisional without using italic serif styling.

## Motion

Retain the existing functional motion but tone down its decoration:

- Short stage crossfade/slide.
- Progress-width transition.
- Quiet completion and validation state changes.
- Small control lift and pressed response.
- Brief correct-answer state resolve.

Remove strong glows and highly saturated animated emphasis. There is no continuous decorative movement. `prefers-reduced-motion: reduce` continues to disable nonessential animation.

## Components and data flow

`QuestionForm` continues to own the single form state, active stage, derived inputs, validation, saving state, and request behavior.

The only component-level behavioral change is preview composition:

- `QuestionPreview` receives the current `QuestionFormInitial` value.
- It renders dedicated Graphite Ledger markup for passage, prompt, answer rows/grid-in, and explanation.
- It continues to call `QuestionBody` and `ChartFigure` for safe rich content.
- It introduces no second form state and no persistence behavior.

The route server components, taxonomy queries, edit mapping, validation library, API routes, payload contracts, and database remain unchanged.

## Error handling and accessibility

- Preserve current inline errors, rail attention states, review summary, save error banner, and in-memory field retention.
- Keep real buttons for stages, selections, answer-key choice, and save actions.
- Keep real labels and associated input IDs.
- Retain visible focus rings with a restrained gold or cool-neutral treatment; green is not required for ordinary focus.
- Maintain text and border contrast in light and dark themes.
- Preserve semantic live regions and focus transfer from review issues.
- Preview content changes must not steal focus or create excessive live announcements.

## Scope exclusions

This revision does not change:

- The four-stage workflow.
- Field order within approved stages.
- Validation or draft requirements.
- Autosave or local persistence.
- API or database behavior.
- Question import behavior.
- Rich-text editing.
- Admin shell, Questions list, or practice-runner design.

## Verification

- Run TypeScript checking and full ESLint.
- Run a production build.
- Verify create and edit routes in authenticated light and dark browser sessions.
- Verify every studio element uses Manrope and no studio-specific serif/Poppins rule remains.
- Verify no large studio surface uses a dark-green background.
- Verify primary actions remain readable without bright mint fills.
- Verify the modern preview for populated and empty MCQ questions.
- Verify the modern preview for populated and empty grid-in questions.
- Verify passage, chart, table, MathML/rich question content, and explanation rendering.
- Verify stage navigation, completion, validation issue focus, save failure retention, draft save, and publish.
- Verify desktop, tablet, mobile preview disclosure, keyboard focus, and reduced motion.
- Run `git diff --check` and preserve unrelated dirty-worktree changes.
