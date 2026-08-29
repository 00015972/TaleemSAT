# Practice Runner Docked Calculator — Design Specification

## Status and precedence

The user approved this layout on 2026-08-29 after reviewing the interactive companion at `.superpowers/brainstorm/35725-1788025001/content/calculator-docked-workspace.html` and selecting **Approve layout**.

This specification supplements `2026-08-29-practice-runner-bluebook-air-refinements-design.md`. It replaces that document's Desmos **Drawer and resizing** requirements and its calculator-specific responsive requirements. All other approved refinement requirements remain unchanged, including the per-question timer, Reading Text Size control, Reference modal, light/dark themes, centered question navigator, and four-corner panel radii.

## Problem

The current Desmos implementation is a fixed left-side overlay. Opening it covers part of the question pane, making the question unreadable even though the rest of the runner has enough horizontal space to reorganize.

The calculator must become part of the workspace layout. On wide screens, opening Desmos must create three readable columns: Calculator, Question, and Answers. Closing it must immediately return the runner to the exact two-pane layout the student had before opening Desmos. On smaller screens, Desmos must appear below the Question and Answers instead of covering them or squeezing three columns together.

## Approaches considered

### 1. Practice-specific workspace controller — selected

Create a practice-only layout component that owns Calculator, Question, Answers, and their separators. It has explicit two-pane, desktop three-pane, and compact stacked modes. The Desmos panel keeps responsibility for loading and managing the calculator instance but no longer positions itself as a viewport overlay.

This provides clean resizing rules, exact restoration, a reliable responsive layout, and isolation from the Mock runner. It is the approved approach.

### 2. Outer calculator column around the existing `ExamSplit`

Place Calculator beside the existing two-pane `ExamSplit` and let the current percentage split operate inside the remaining width. This reuses more code, but a 50/50 stored split can leave Answers too wide and Question too narrow after Calculator opens. Correcting that temporarily would add an override contract and two interacting sizing systems with harder clamping behavior.

### 3. Generalize shared `ExamSplit` to support arbitrary panes

Convert `ExamSplit` into a general multi-pane primitive used by Practice and Mock. This is flexible but expands the regression surface for Mock, changes a stable shared component for one practice-only need, and adds more abstraction than the current requirement justifies.

## Approved interaction model

### Calculator closed: normal two-pane mode

- Render Question, the existing draggable divider, and Answers.
- Read and persist the Question/Answers ratio under the existing `taleem_practice_split` key.
- Preserve current pointer and keyboard resizing behavior.
- Navigation between questions must not reset this ratio.

### Calculator open on wide screens: three-pane mode

- Render panels in this order: Calculator, Question, Answers.
- Render a vertical separator between Calculator and Question and another between Question and Answers.
- The Calculator separator changes Calculator width.
- The Question/Answers separator changes the allocation between the center Question panel and the right Answers panel without altering the saved closed-mode split.
- All three panels remain opaque, independently scrollable, fully rounded on all four corners, and separated by visible canvas gaps.
- The calculator is a normal layout region, not `position: fixed`, `absolute`, a portal overlay, or a modal.
- The transition between two and three panels should feel immediate. A coordinated layout transition of at most 180 milliseconds is allowed; `prefers-reduced-motion` must disable it.
- Opening Calculator must not change question, answer selection, review flag, eliminated answers, highlights, timer, navigator state, or scroll state unnecessarily.
- Closing via the header trigger, panel Close button, or Escape removes the Calculator column and restores the exact saved two-pane ratio.

### Small screens: calculator below the exam workspace

- At `max-width: 1180px`, do not render three squeezed columns. This is the calculator-docking breakpoint; the existing narrower phone breakpoint may still stack Question and Answers vertically.
- Keep Question and Answers in their existing responsive arrangement above.
- When Calculator is open, add it as a full-width block below the complete Question-and-Answers workspace.
- The lower calculator block pushes content and participates in workspace scrolling; it never overlays either exam panel. Its default height is `clamp(360px, 45dvh, 600px)`.
- Hide the desktop Calculator separator in this mode. Calculator height may be clamped to a useful viewport-relative range and should be touch-friendly.
- Closing Calculator removes the lower block and returns the page to its previous responsive Question/Answers layout.
- Existing phone behavior that stacks Question and Answers vertically remains valid; Calculator follows both panels.

## Sizing and persistence

Use distinct preferences so opening one mode never corrupts another:

- `taleem_practice_split`: existing closed-mode Question/Answers percentage.
- `taleem_practice_calculator_width`: existing wide-screen Calculator width in pixels.
- `taleem_practice_calculator_answer_width`: new optional wide-screen Answers width in pixels, written only when the user moves the second separator while Calculator is open.

The third key is preferred over writing an open-mode percentage into `taleem_practice_split`. Initial wide-screen defaults are `clamp(340px, 27vw, 520px)` for Calculator and `clamp(330px, 25vw, 460px)` for Answers.

Wide-screen clamping must be computed from the current workspace bounds, not `window.innerWidth` alone. Enforce all of the following:

- Calculator retains a minimum width of 340 pixels.
- Question retains a minimum width of 360 pixels.
- Answers retain a minimum width of 330 pixels for the external cross-out controls and answer text.
- The two separators and workspace gaps are included in the calculation.

When the viewport becomes too narrow to satisfy all three minimums, switch to the compact stacked mode rather than violating the minimums. Resize events must re-clamp saved values for rendering without destroying the stored user preference; returning to a larger viewport should restore the preferred wide-screen widths when possible.

## Component architecture

### `PracticeWorkspace`

Add a practice-specific component under `components/practice/` that receives:

- `question`: the complete Question pane node;
- `answers`: the complete Answers pane node;
- `calculator`: the Desmos panel node for Math runs;
- `calculatorOpen`;
- callbacks for closing Calculator;
- the existing line-reader overlay.

It owns layout mode selection, pane sizing, the two accessible separators, persistence, clamping, and responsive composition. It must not own question data, answer state, Desmos API loading, timer state, or Math detection.

The component uses the 1180-pixel calculator-docking breakpoint through one exported constant or CSS custom property and mirrors it through `matchMedia` only where JavaScript sizing behavior requires it. Avoid maintaining conflicting literal breakpoint values across multiple files.

### `PracticeDesmosDrawer`

Refactor the existing component into an in-flow panel. Renaming it to `PracticeDesmosPanel` is preferred because `Drawer` would no longer describe its behavior; if renamed, update imports without leaving a compatibility wrapper that is unused.

The component continues to own:

- lazy loading the official Desmos `GraphingCalculator`;
- the ignored environment-provided API key;
- Calculator header and Close action;
- loading, configuration, and retry states;
- one persistent Desmos instance across open/close and question navigation;
- `ResizeObserver` calls to `calculator.resize()`;
- instance destruction when the practice runner unmounts;
- returning focus to the Calculator trigger after close.

It no longer owns viewport positioning, width persistence, or its own right-edge resize separator. Those are workspace responsibilities.

When hidden, preserve the mounted Desmos instance without leaving an interactive off-screen region. Use `hidden`, an inactive grid area, or equivalent semantics that prevent keyboard focus while retaining calculator state.

### `PracticeRunner`

Replace the current `ExamSplit` plus separately rendered fixed Calculator with `PracticeWorkspace`. Continue to construct `QuestionPane` and `ChoicesPane` in `PracticeRunner` and pass them as composed nodes. Reference remains a modal and is not part of this workspace.

Calculator remains Math-only. Reading and Writing must never allocate an empty calculator region.

### Shared exam code

Do not change Mock layout behavior. `ExamSplit` may remain unchanged. If a small helper for clamping or separator keyboard behavior is shared, it must be backward-compatible and have no styling or persistence side effects for existing consumers.

## Accessibility

- Each divider uses `role="separator"`, `aria-orientation="vertical"`, a specific accessible label, `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`.
- Arrow Left and Arrow Right resize the focused desktop separator in consistent increments.
- Visible focus styling must work in light and dark modes.
- Pointer capture must end safely on pointer up and pointer cancel.
- The Calculator region uses `role="region"` with an accessible Desmos label rather than modal semantics.
- Calculator Close and Escape return focus to the header Calculator trigger.
- Compact mode removes the inactive separator from both visual layout and the tab order.
- Reduced-motion users get an immediate layout change with no animated width transition.

## Failure and edge behavior

- Desmos loading or API-key failure affects only the Calculator panel; Question, Answers, navigation, and answer checking remain functional.
- Opening Calculator while Desmos loads immediately reflows the layout and shows the existing loading state in the new panel.
- A missing or malformed persisted width falls back to defaults.
- Storage access failure keeps resizing functional for the current visit.
- Full-screen changes and browser resizing re-evaluate the available workspace without resetting preferred widths.
- Navigating between Math questions keeps the Calculator open state and current expressions for the active practice run.
- Exiting the runner destroys the Desmos instance as it does now.

## Styling

- Scope new rules under `.ex-practice` and practice-specific class names.
- Retain the approved Bluebook Air canvas, Manrope typography, light/dark palettes, panel borders, shadows, and complete corner radii.
- Use the existing professional divider grip language for both desktop separators.
- Do not add imagery, watermarks, transparent question panels, or additional branding.
- The centered footer navigator remains geometrically centered and unaffected by Calculator width.
- The Reading Text Size control remains present in Appearance and is unaffected by the layout refactor.

## Verification

### Automated

- Run ESLint for every changed TypeScript/TSX file.
- Run the repository TypeScript check.
- Run the production Next.js build.
- Add focused tests if the existing harness can exercise size clamping or persistence without introducing a new framework.

### Manual matrix

- Wide Math, Calculator closed: current two-pane split renders and resizes normally.
- Wide Math, Calculator open: three in-flow panels render; no question content is covered.
- Drag Calculator separator: Desmos resizes continuously and the width persists across close/reopen and question navigation.
- Drag Question/Answers separator while Calculator is open: only the open-mode allocation changes; closed-mode `taleem_practice_split` remains unchanged.
- Close Calculator through trigger, Close button, and Escape: exact previous two-pane ratio returns and focus returns to the trigger.
- Reopen Calculator: Desmos expressions and preferred open-mode widths remain.
- Resize across the responsive breakpoint: Calculator moves below both exam panels without overlay, then returns to the left when wide again.
- Phone layout: Question, Answers, then Calculator appear in that order with no horizontal overflow.
- Light and dark modes: all three panels, separators, loading/error states, question number, difficulty, and Check answer remain legible.
- Full screen: layout recalculates without losing preferences.
- Reading and Writing: no Calculator panel or blank grid track is rendered.
- Reading Text Size, Reference modal, highlights, answer elimination, flags, per-question timer, centered navigator, keyboard navigation, and answer checking retain their approved behavior.
- Mock runner and Question Bank browse page show no layout or behavior regression.

## Out of scope

- Changing Desmos calculator type or API version.
- Changing the timer logic.
- Saving Desmos expressions across separate practice sessions.
- Adding a Reset Layout control.
- Redesigning the Reference modal, question cards, answer cards, footer navigator, or Question Bank browse page beyond changes required to host the in-flow calculator.
