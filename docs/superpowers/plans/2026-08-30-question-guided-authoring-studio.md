# Question Guided Authoring Studio Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-30-question-guided-authoring-studio-design.md`

**Goal:** Replace the shared create/edit question form with a responsive four-stage professional authoring studio while preserving all existing question data, validation, preview, and save behavior.

**Constraint:** Do not change database, API, authentication, validation, or persistence contracts. Preserve unrelated dirty-worktree changes, especially the existing admin-shell work in `app/globals.css`.

## Task 1: Introduce the shared staged workflow

**Files:**

- Modify `components/admin/question-form.tsx`

**Steps:**

1. Add active-stage state and a stable four-stage definition.
2. Group existing fields into Foundation, Prompt, Answer, and Review sections without changing their values or handlers.
3. Add accessible rail navigation, stage completion/error states, and Back/Continue actions.
4. Keep all save actions and full validation in the Review stage.
5. Preserve create/edit props and the existing POST/PATCH request logic.

## Task 2: Refine live preview and responsive access

**Files:**

- Modify `components/admin/question-form.tsx`

**Steps:**

1. Keep the real `QuestionBody`, `ChartFigure`, `GridInInput`, table, and `.prx-*` rendering path.
2. Wrap the preview in the studio presentation with live-sync and difficulty metadata.
3. Keep the preview sticky on wide layouts.
4. Add a keyboard-accessible compact preview disclosure for mobile layouts.

## Task 3: Unify create and edit route presentation

**Files:**

- Modify `app/(admin)/admin/questions/new/page.tsx`
- Modify `app/(admin)/admin/questions/[id]/edit/page.tsx`

**Steps:**

1. Replace the generic route wrappers with shared question-studio route/header classes.
2. Preserve breadcrumbs, page metadata, status display, data loading, and form props.
3. Add concise route-specific copy and visual context without changing navigation.

## Task 4: Add isolated visual and motion system

**Files:**

- Modify `app/globals.css`

**Steps:**

1. Append a `.question-studio-*` namespace to avoid disturbing existing admin work.
2. Implement ivory, emerald, and restrained gold surfaces in light and dark themes.
3. Add the three-column workspace, staged editor, sticky preview, validation summary, and control states.
4. Add short entrance, stage transition, progress, answer-key, and inline-error motion.
5. Add tablet/mobile layouts and `prefers-reduced-motion` fallbacks.

## Task 5: Verify the integrated redesign

**Files:** all changed files

**Steps:**

1. Run `pnpm typecheck`.
2. Run ESLint on the changed TypeScript/TSX files.
3. Run `pnpm build`.
4. Run `git diff --check` and inspect the scoped diff.
5. Verify create/edit, stage navigation, MCQ/grid-in switching, field validation, preview sync, save states, keyboard focus, responsive layouts, and reduced motion.
