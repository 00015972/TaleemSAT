# Practice Runner “Bluebook Air” Refinements — Design Specification

## Status

The visual direction was approved by the user on 2026-08-29 after review of the interactive browser companion at `.superpowers/brainstorm/27060-1787988112/content/practice-runner-refinement.html`.

This specification records the approved refinement before production implementation. It supplements `2026-08-29-practice-runner-bluebook-air-design.md`; when the two documents differ, this refinement is the current requirement.

The user explicitly corrected the earlier timer request: the timer must continue to reset for every question. Timer behavior is out of scope and must not be changed.

## Objective

Refine the Question Bank practice runner so it more closely supports the useful interactions of a professional Digital SAT practice environment while retaining TaleemSAT’s Bluebook Air visual identity. The page should remain polished, readable, and recognizably a practice product rather than copying Bluebook literally.

The implementation must add richer highlighting, section-aware tools, a custom reference sheet, an embedded resizable Desmos graphing calculator, stronger dark-mode contrast, centered navigation, and restrained TaleemSAT branding. It must preserve the existing reading text-size control, per-question timer, practice answer/retry behavior, resizable question split, and unrelated user work in the dirty worktree.

## Scope and isolation

- Apply changes only to the full-screen runner launched from `/question-bank`.
- Do not redesign the Question Bank browse page.
- Do not change Mock runner behavior or styling as a side effect.
- Prefer practice-specific components or explicit variants over broad changes to shared `.ex-*` components.
- Shared primitives may be extended only through backward-compatible optional props.
- Preserve every unrelated modified, deleted, and untracked file in the current worktree.

## Approved visual direction

### Canvas and panels

- Keep the existing light/dark Bluebook Air palette and Manrope typography.
- Give the Question Bank runner a subtle page-only atmospheric canvas using CSS gradients and restrained geometric texture. Do not use photographs, illustration assets, the logo, the wordmark, or question content as a background watermark.
- Question and answer panels remain opaque so passage and answer readability is never reduced.
- Both panels receive border radius on all four corners. The divider occupies a visible gap between them; neither panel visually joins the other panel.
- Preserve independent pane scrolling and the existing persisted split ratio under `taleem_practice_split`.

### TaleemSAT identity

- Add a compact brand lockup in the footer-left area using `public/logo.jpg` and the text `TaleemSAT`.
- The complete lockup is an external link to `https://t.me/TaleemSAT`, opens in a new tab, and uses `rel="noopener noreferrer"`.
- Keep branding visually secondary to the question. It must not become a watermark or reduce available reading width.
- Retain the keyboard shortcut hint in a compact secondary form when space permits; narrow layouts may hide the hint before hiding the brand link.

### Dark-mode contrast and difficulty

- In dark mode, the question-number tile uses a light blue or similarly high-contrast surface with dark text instead of dark navy on a dark panel.
- Check answer remains dark navy in light mode. In dark mode it uses a brighter blue treatment with dark text or another contrast-safe equivalent while preserving the same button identity and tactile hover/pressed animation.
- Disabled Check answer remains legible and visibly disabled; it must not disappear into the panel.
- The Medium difficulty badge is yellow/gold in light and dark modes. Easy remains green and Hard remains red.

## Section-aware runner state

The current passage-presence proxy is not reliable enough to decide whether SAT Math tools should be shown.

- Extend `PracticeScope` with a stable `subjectSlug` value.
- Populate `subjectSlug` for subject, category, topic, search, and recommendation launch paths in `practice-browse.tsx`.
- Treat `subjectSlug === "math"` as Math; all other current SAT subjects use the Reading and Writing tool set.
- Use the same stable subject value for directions, toolbar composition, and any section-specific behavior.
- This change is client metadata only; the existing manifest/question API contract does not need an extra database query.

## Header tools

### Reading and Writing

Show only:

1. Highlights/Annotate
2. Appearance
3. More
4. Full screen

Do not render Calculator or Reference controls for Reading and Writing questions.

### Math

Show only:

1. Appearance
2. Calculator
3. Reference
4. More
5. Full screen

Do not render the passage highlighting control for Math.

### Appearance menu

- Preserve the existing Light/Dark control and persistence.
- Preserve the existing Reading Text Size section with Standard, Large, and Extra large options.
- Do not remove or rename the existing reading-size storage key or HTML data attributes.
- The text-size choices remain available from Appearance in both sections, because Math questions can also contain substantial text.

## Multi-color highlights

### Interaction

- Replace the practice runner’s single-color `Set<number>` highlight state with per-word color state supporting Yellow, Blue, and Pink.
- Keep highlight state keyed by question ID so it survives moving away from a question and returning during the run.
- When annotation mode is enabled, selecting a word or text range opens a compact floating palette near the selection.
- The palette provides Yellow, Blue, Pink, and Erase controls. The selected color is clearly indicated.
- Clicking or tapping a single word remains a usable fallback and applies the current color.
- Applying a new color to an already highlighted selection replaces its previous color; Erase removes highlighting from that selection.
- Clearing highlights from More removes every color on the current question.
- Highlight count reports the number of highlighted word tokens, not the number of color groups.

### Implementation boundary

- Use a practice-specific passage highlighter or an explicit multi-color mode on `PassageReader` that leaves the Mock runner’s existing contract intact.
- Do not store raw HTML from the selection. Continue to render question text from the existing sanitized source and track highlights by stable token index.
- A floating palette rendered in a portal must inherit the current practice light/dark palette.

## Mark for review

- Preserve the existing flag state and question navigator marker.
- Inactive state uses the professional outlined bookmark.
- Active state fills the bookmark yellow/gold and underlines the `Mark for review` label.
- Keep the label wording stable; do not replace it with `Marked` after activation.
- The control retains `aria-pressed`, keyboard activation, focus indication, and the existing `F` shortcut.

## Cross-out controls

- Keep the `ABC` control in the answer toolbar as the switch that enables or disables elimination mode.
- When elimination mode is active, render one compact cross-out control beside each answer card, outside the card boundary.
- The external control must not trigger answer selection.
- Eliminating an answer applies a visible line-through and subdued card state; activating the same control again restores it.
- Preserve eliminated choices per question while navigating.
- Correct/incorrect/solved states take precedence over elimination styling.
- Grid-in questions do not show the `ABC` control or external answer eliminators.
- On narrow screens, preserve a minimum 40-pixel target and prevent the external control from causing horizontal overflow.

## Math reference modal

- Replace the current compact reference popover for Question Bank practice with a large modal dialog inspired by the supplied reference.
- Build all figures locally as inline SVG or semantic HTML/CSS; do not use downloaded screenshots or generated raster images.
- Include the standard SAT reference groups represented in the approved mockup:
  - circle area and circumference;
  - rectangle area;
  - triangle area;
  - Pythagorean theorem;
  - special right triangles;
  - rectangular prism, cylinder, sphere, cone, and pyramid volumes;
  - circle degrees/radians and triangle-angle facts.
- Use labeled variables and formulas with a readable math/serif treatment while keeping interface chrome in Manrope.
- The modal follows light/dark mode, is scrollable on small viewports, traps focus, closes via the close button, backdrop, or Escape, and returns focus to the Reference trigger.
- Render the modal above the exam shell without changing pane size or split persistence.

## Desmos graphing calculator

### Integration

- Use the official Desmos `GraphingCalculator`, not Scientific, FourFunction, Geometry, or Calculator3D.
- Load `https://www.desmos.com/api/v1.12/calculator.js` lazily only after a Math user first opens Calculator.
- Read the supplied browser API key from `NEXT_PUBLIC_DESMOS_API_KEY`; do not hard-code it into TSX, CSS, documentation, or committed source.
- Add the environment-variable name to `.env.example` without a value and add the supplied value only to the ignored local environment file.
- Keep required Desmos branding visible and comply with the applicable Desmos API terms.

### Drawer and resizing

- Present Desmos in a left-side drawer below the exam header and above the footer, matching the approved visual companion and supplied Math reference.
- The drawer overlays the runner rather than mutating the persisted question/answer split ratio.
- Provide a visible title, Close action, and draggable right-edge resize handle.
- Clamp width to a usable desktop range and persist it under a dedicated key such as `taleem_practice_calculator_width`.
- On narrow viewports, use a nearly full-width/full-height sheet instead of a narrow desktop drawer.
- Call the Desmos instance’s resize method through a `ResizeObserver` while the drawer changes size.
- Keep the calculator instance and its expressions alive when the student closes/reopens it or moves between Math questions during the same practice run. Destroy it when the practice runner unmounts.
- Show a clear inline loading state and a recoverable error/configuration message if the script or API key is unavailable.

## Footer and centered navigator

- Preserve the existing navigator design, question-grid behavior, status legend, and jump behavior.
- Position the navigator at the true horizontal center of the viewport independent of footer-left branding and footer-right paging widths.
- On desktop, use absolute centering (`left: 50%` plus translation) or an equivalently invariant layout rather than relying only on content-sized grid tracks.
- Keep Back and Next on the right and the TaleemSAT lockup on the left.
- Ensure the navigator popover opens upward without clipping.
- On narrow viewports, switch to a non-overlapping stacked footer layout while keeping the navigator visually primary.

## Timer

- Make no timer logic changes.
- The timer continues to start at zero for each question, reset on question navigation, and freeze when that question is solved, exactly as it currently does.
- Preserve per-question attempt timing sent to `/api/practice/answer`.

## Responsive behavior

- Desktop and landscape tablet keep the resizable side-by-side panes with fully rounded cards.
- At the existing mobile breakpoint, stack the panels and remove the desktop separator.
- Reference becomes a scrollable near-full-screen dialog on small screens.
- Calculator becomes a large sheet with accessible close and resize behavior adapted to touch.
- Floating highlight controls remain within the viewport and never cover the selected text unnecessarily.
- Top-bar tools may compact, but section-essential tools remain accessible.

## Accessibility and resilience

- Preserve semantic buttons and current keyboard shortcuts.
- All color choices, icon-only actions, modal controls, and external cross-out buttons have accessible names.
- Highlight colors cannot be the only way to distinguish a selected palette control; use outline/check state and `aria-pressed`.
- Keep visible focus rings across both themes.
- Respect `prefers-reduced-motion` for button and palette animations.
- Modal and calculator overlays use correct dialog/region semantics and Escape behavior.
- Desmos loading failure must not block answering or navigating questions.

## Component plan

Expected production changes are limited to the smallest coherent set:

- `components/practice/practice-browse.tsx`: carry `subjectSlug` in every scope.
- `components/practice/practice-runner.tsx`: compose section-aware tools, multi-color state, unchanged timer, branding, active review styling, external eliminators, and overlay state.
- `components/practice/types.ts` only if a practice-specific UI type belongs there; no answer data is exposed.
- A new practice-specific highlighter component or backward-compatible extension to `components/reading/passage-reader.tsx`.
- New practice-specific Reference modal and Desmos drawer components, ideally under `components/practice/`.
- `components/exam/exam-toolbar.tsx` only for backward-compatible shared trigger primitives if necessary; do not replace Mock’s current calculator/reference behavior.
- `app/globals.css`: all new visual rules scoped beneath `.ex-practice` or unique practice component prefixes.
- `.env.example`: empty Desmos variable declaration.
- Local ignored `.env.local`: supplied key for local verification.
- A small ambient type declaration for the Desmos browser API if TypeScript requires it.

## Verification

### Automated

- Run ESLint on every changed TypeScript/TSX file.
- Run the repository TypeScript check.
- Run a production Next.js build.
- Add focused tests if an existing test harness covers the changed components; do not introduce a new test framework solely for this refinement.

### Manual practice-runner matrix

- Reading question, light mode: no Calculator or Reference; highlighting palette supports Yellow/Blue/Pink/Erase.
- Reading question, dark mode: highlights, review bookmark, question number, Check answer, and Medium badge remain legible.
- Math question, light and dark: Calculator and Reference render; Highlight does not.
- Appearance in both sections: Reading Text Size remains present and changes Standard/Large/Extra large content sizing.
- Reference: custom figures and formulas render, scroll, trap focus, close by all supported methods, and restore trigger focus.
- Desmos: first-load, reopen, expression persistence, question navigation, drawer resizing, persisted width, responsive sheet, error fallback, and teardown.
- Mark for review: yellow filled bookmark, underlined stable label, navigator flag, keyboard shortcut.
- Cross-out: controls sit outside cards, do not select answers, restore correctly, and persist per question.
- Question/answer split: all four corners rounded, drag and keyboard resizing work, and ratio persists across questions.
- Footer: logo/wordmark opens `https://t.me/TaleemSAT`; navigator remains geometrically centered at wide and narrow desktop widths.
- Timer: still resets on every new question and freezes only when the current question is solved.
- MCQ, grid-in, wrong retry, eventual solve, charts, tables, MathML, loading, empty, error, full screen, question navigator, and reduced-motion behavior remain intact.
- Confirm the Mock runner and Question Bank browse page have no visual or behavioral regression.

## Deferred ideas after this implementation

These are recommendations for later discussion, not part of this change:

- an optional Hide Timer control for students with test anxiety;
- a Reset Layout action for divider and calculator widths;
- a lightweight notes/scratchpad tool with per-question persistence;
- a practice-session summary showing accuracy, time distribution, flags, and eliminated choices;
- resume-in-progress practice across browser sessions;
- an end-of-set review page grouping unanswered, incorrect, and marked questions;
- explicit keyboard help surfaced from More rather than relying only on the footer hint.
