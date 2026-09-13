# Practice Runner “Bluebook Air” — Approved Design

## Status

Approved by the user on 2026-08-29 after browser review of three directions and an interactive refinement of Option B. The approved refinement includes light and dark modes, a navy Check answer action, a persistent draggable panel divider, and a bottom-centered question navigator.

## Objective

Redesign the full-screen Question Bank practice runner so it feels like a focused, professional Digital SAT preparation environment. Replace the current dry serif presentation and decorative watermark treatment with a calm Bluebook-inspired workspace that remains recognizably Taleem SAT through its navy, mint, typography, and tactile interaction details.

The runner must remain a practice experience rather than pretending to be an official timed SAT module. Existing practice feedback, retries, explanations, keyboard shortcuts, reading tools, menus, calculator, reference sheet, line reader, navigator, charts, tables, and grid-in questions remain functional.

## Scope and isolation

- The redesign applies to the full-screen runner opened from `/question-bank` after a subject, category, or topic is selected.
- The Question Bank browse screen and its approved Practice Arcade design remain unchanged.
- The mock-test runner keeps its existing visual treatment unless a small shared icon replacement is necessary to remove an emoji from a shared exam toolbar. Shared icon changes must not alter mock-test behavior or layout.
- Add a practice-specific root class or variant to shared exam chrome so the Bluebook Air palette and layout cannot leak into mock, QOD, admin, auth, dashboard, or browse surfaces.
- Preserve unrelated uncommitted repository changes.

## Visual system

### Typography

- Use Manrope for the entire practice runner: navigation, topic labels, timer, passages, question stems, answer choices, feedback, menus, and footer controls.
- Retain the existing user-controlled reading-size scale from the Appearance menu.
- Use weight and spacing—not a second display font—to distinguish interface labels from long-form question content.

### Light mode

- Navy chrome: `#152e4d` with a deeper pressed/shadow tone near `#0d2239`.
- Cool exam canvas: `#e9eff3`.
- White question and answer panels with quiet blue-gray borders near `#cbd7df`.
- Primary text near `#17243b`; secondary text near `#60758a`.
- Mint near `#35b779` is reserved for the top progress/accent rule and positive or difficulty states.

### Dark mode

- Preserve the same navy header and action identity.
- Use a midnight canvas near `#0d1721`, raised panels near `#182634`, answer surfaces near `#1c2c3a`, and blue-gray dividers near `#35495c`.
- Use near-white primary text and muted blue-gray secondary text with WCAG-readable contrast.
- Dark mode is controlled by the existing Appearance menu and persists through the existing global theme storage behavior.

### Imagery and icons

- Do not render photographs, illustrations, the logo watermark, the repeated Taleem SAT watermark, or other background images inside the practice runner.
- Replace bookmark, palette/appearance, calculator, reference, fullscreen, reading-tool, and related emoji glyphs shown by this page with a coherent set of small outlined SVG icons.
- Decorative icons are hidden from assistive technology; interactive icon-only controls retain accessible names and tooltips.

## Desktop layout

1. A compact navy top bar contains:
   - All topics exit control and current topic/difficulty/directions on the left.
   - The per-question timer centered independently of the side content.
   - Professional outline tool controls on the right, including the existing Appearance menu used for light/dark mode.
2. The main workspace uses two independently scrolling raised panels over the cool canvas:
   - The left panel contains question number, difficulty, passage/chart/table content, and stem.
   - The right panel contains Mark for review, elimination/check controls, answer choices or grid-in input, and answer feedback/explanation.
3. A visible vertical divider sits between the panels. It has a subtle central grip and a stronger blue hover/focus/drag state.
4. The footer keeps shortcuts on the left, Back/Next on the right, and the `Question N of total` navigator geometrically centered at the bottom of the viewport.

## Persistent resizable split

- Preserve the existing `ExamSplit` pointer and keyboard resizing behavior.
- Keep the existing practice-specific storage key, `taleem_practice_split`, so the selected ratio survives navigation to other questions and future practice visits in the same browser.
- Clamp the ratio to a usable range so neither pane can become unreadably narrow.
- Keep the separator keyboard accessible with Left/Right Arrow adjustment, `role="separator"`, orientation, and an accessible label.
- Restyle the divider and grip without replacing the existing persistence logic.

## Controls and interaction

- Change Check answer from green to the page’s dark navy in both light and dark modes, with white text and a deeper navy lower shadow.
- Apply the same tactile visual language to Next: a small upward hover lift, downward pressed state, and restrained lower shadow.
- Answer rows receive a short horizontal hover response and blue focus/selection treatment. Correct, incorrect, eliminated, and solved states retain distinct semantic colors and cannot depend on motion alone.
- Mark for review uses an outlined bookmark icon and clear active state.
- Tool buttons use professional outlined SVGs, consistent square sizing, and visible hover, active, disabled, and focus states.
- Popovers for Appearance, Calculator, Reference, More, and the question navigator follow the active light or dark palette.
- All transitions are disabled or reduced under `prefers-reduced-motion: reduce`.

## Footer and navigator

- Use a three-column footer grid with equal outer tracks and an auto-width center track so the question navigator stays at the true viewport center regardless of the widths of shortcuts and paging controls.
- The navigator continues to open the existing full question grid, status legend, and jump behavior.
- Back and Next remain on the right. Existing disabled states at the first and last question remain intact.
- On narrow screens, controls may compact or wrap, but the navigator remains the primary centered footer element and never overlaps paging buttons.

## Responsive behavior

- Desktop and landscape tablet retain the draggable side-by-side panes.
- At viewport widths of 760 pixels or below, switch to a stacked question/answer flow and hide the desktop drag grip while preserving all content and controls.
- The top bar may hide secondary text labels before removing any essential action.
- On touch and narrow layouts, interactive targets are at least 40 pixels high or wide; long topic names and answer text wrap without clipping.

## Existing states to preserve

- Manifest loading, individual-question loading, empty set, and network error states.
- Selected, eliminated, previously tried, solved, correct-first-try, and eventually-solved answer states.
- Grid-in input, prior incorrect grid-in answers, charts, tables, MathML, passages, vocab definitions, highlighting, and AI explanation panel.
- Per-question flags, highlights, attempts, cached questions, timer freezing, keyboard shortcuts, and navigator status bubbles.
- Light/dark and reading-size persistence.

## Component boundaries

- `PracticeShell` opts into the practice-specific runner variant and continues to own practice state and data fetching.
- `ExamRoot` accepts a `variant="practice"` prop that adds the practice-specific styling hook without changing the default mock-runner contract.
- `ExamSplit` retains its current storage and resizing implementation; only its practice-scoped presentation changes.
- Shared exam toolbar controls may replace emoji glyphs with reusable inline SVG icon components. Their menus and state ownership remain unchanged.
- New CSS is scoped beneath the practice-runner root in `app/globals.css`; existing general `.ex-*` styles remain the fallback for other exam contexts.

## Accessibility

- Maintain semantic buttons, labels, `aria-pressed`, `aria-expanded`, dialog roles, and keyboard behavior already present.
- All icon-only controls have accessible names and visible focus rings.
- Divider focus and current navigator state remain visibly identifiable.
- Light and dark text, borders, semantic feedback states, and disabled controls maintain readable contrast.
- Motion is supplementary and respects reduced-motion preferences.

## Verification

- Run ESLint on every changed TypeScript/TSX file.
- Run the repository TypeScript check.
- Run a production Next.js build.
- In an authenticated browser, verify both Reading and Math practice questions in light and dark modes.
- Verify dragging and keyboard-resizing the split, moving to multiple questions, opening the navigator, and returning to the practice runner preserve the split ratio.
- Verify the navigator remains bottom-center at desktop and narrow widths.
- Verify MCQ, grid-in, chart, table, MathML, loading, empty/error, wrong-answer retry, correct-answer, explanation, flag, highlight, calculator, reference, line-reader, fullscreen, and reduced-motion states.
- Confirm the Question Bank browse page and mock runner have no unintended layout or palette changes.
