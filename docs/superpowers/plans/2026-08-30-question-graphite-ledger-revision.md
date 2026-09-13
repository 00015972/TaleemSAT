# Question Studio Graphite Ledger Revision Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-30-question-graphite-ledger-revision-design.md`

**Goal:** Restyle the approved four-stage question studio with Manrope, neutral Graphite Ledger surfaces, subdued controls, and a dedicated modern assessment preview.

**Constraint:** Preserve the existing staged workflow, form state, validation, API requests, route data loading, responsive behavior, and unrelated dirty-worktree changes.

## Task 1: Replace the legacy preview composition

**Files:**

- Modify `components/admin/question-form.tsx`

**Steps:**

1. Remove the legacy disabled `GridInInput` preview dependency.
2. Replace `.prx-card`, `.prx-opt`, `.prx-expl`, and related preview markup with dedicated `.question-studio-assessment-*` elements.
3. Keep `QuestionBody` and `ChartFigure` for sanitized rich content, tables, MathML, and SVG charts.
4. Add modern MCQ rows, rounded-square answer markers, correct-answer state, grid-in preview, and explanation panel.
5. Preserve the current preview props and single-source-of-truth data flow.

## Task 2: Apply the Graphite Ledger visual system

**Files:**

- Modify `app/globals.css`

**Steps:**

1. Add scoped light/dark Graphite Ledger tokens under `.question-studio-route`.
2. Enforce Manrope throughout the route and preview.
3. Replace green-filled route, progress, editor, preview, input, and selection surfaces with neutral graphite or cool-gray surfaces.
4. Restrict antique gold to progress/metadata and green to semantic live/completed/correct states.
5. Replace bright mint primary actions with muted charcoal/graphite-blue controls and shallow pressed depth.
6. Tone down decorative glows while preserving purposeful stage and validation motion.
7. Style dedicated assessment content, tables, charts, MCQ, grid-in, and explanation in both themes.

## Task 3: Verify the revision

**Files:** all changed files

**Steps:**

1. Run TypeScript checking and full ESLint.
2. Run a production build.
3. Run `git diff --check` and inspect the scoped diff.
4. Verify Manrope-only studio typography and absence of legacy preview structural classes.
5. Verify create/edit, MCQ/grid-in, passage, chart, table, validation, save, responsive disclosure, light/dark, focus, and reduced-motion behavior.
