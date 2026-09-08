# Analytics Score Observatory Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-08-analytics-score-observatory-design.md`

**Goal:** Replace the current generic Analytics page with the approved Score Observatory, add a transparent deterministic Readiness Index and 30-day trajectory, preserve resilient AI insights, and deep-link the priority skill into Question Bank.

**Constraint:** Preserve the current authentication and tier policy, avoid database migrations, do not create a 400–1600 score prediction, and isolate visual changes to Analytics and its active app shell.

## Task 1: Add deterministic readiness analytics

**Files:**

- Modify `lib/analytics/overview.ts`
- Create `lib/analytics/readiness.ts`
- Create `lib/analytics/readiness.test.ts`

**Steps:**

1. Extend category analytics with stable identifiers/slugs and recent-window values.
2. Load available published category taxonomy through the existing practice-overview RPC.
3. Implement the approved pure readiness formula, confidence classification, factor contributions, 30-day historical series, and explicit 12-question counterfactual.
4. Derive power, rising, and priority signals without labelling sparse categories as reliable.
5. Return 30-day accuracy, volume, coverage, active-day cadence, and readiness data in `AnalyticsOverview`.
6. Add tests for formula boundaries, neutral/clamped momentum, sparse evidence, historical carry-forward, confidence, priority selection, and counterfactual impact.

## Task 2: Build the Score Observatory component system

**Files:**

- Rewrite `app/(app)/analytics/page.tsx`
- Create `components/analytics/analytics-observatory.tsx`
- Create `components/analytics/readiness-trajectory.tsx`
- Modify `components/analytics/ai-insight-panel.tsx`
- Reuse or retire compatible exports in `components/analytics/charts.tsx`

**Steps:**

1. Keep authentication, tier gating, profile loading, and server ownership in `AnalyticsPage`.
2. Render the performance header, target destination, trajectory/Coach Signal hero, evidence cards, skill signals, detailed category view, subject balance, and activity evidence.
3. Add keyboard/pointer trajectory inspection and an accessible readiness-formula disclosure.
4. Keep deterministic priority content visible before AI hydration and make AI narrative progressive enhancement.
5. Redesign free, empty, sparse, missing-profile, AI-failure, and analytics-query-failure states in the Observatory language.

## Task 3: Add the isolated Observatory visual and motion system

**Files:**

- Modify `app/globals.css`

**Steps:**

1. Add a scoped `.observatory-*` visual namespace with Focus Arcade tokens, atmosphere, card depth, typography, and hierarchy.
2. Theme the app shell/sidebar only while the Analytics page is present.
3. Add staggered reveals, count-up support, trajectory draw/point animation, annotation float, artwork motion, and tactile hover/active states.
4. Add desktop, tablet, and mobile layouts with collision-safe chart labels and full-width mobile actions.
5. Add visible focus states and a comprehensive reduced-motion override.

## Task 4: Deep-link the priority signal into Question Bank

**Files:**

- Modify `app/(app)/question-bank/page.tsx`
- Modify `components/practice/practice-shell.tsx`
- Modify `components/practice/practice-browse.tsx` if selection ownership requires it

**Steps:**

1. Accept optional `category` and `mode=focus` search parameters at the server page.
2. Validate the slug against `PracticeOverview` and pass only a safe initial category selection.
3. Open the matching category in Question Bank and preserve existing browse/run behavior.
4. Fall back to the normal browse state for invalid, absent, or unavailable categories.

## Task 5: Align AI narrative with deterministic priority

**Files:**

- Modify `app/api/ai/insights/route.ts`
- Modify `lib/ai/weakness.ts`
- Modify `components/analytics/ai-insight-panel.tsx`

**Steps:**

1. Include a Score Observatory prompt version in the cache hash input.
2. Keep the existing tier gate, minimum-attempt rule, rate cap, cache behavior, and PII-free summary.
3. Treat AI output as narrative only; never source readiness or counterfactual values from the model.
4. Validate narrative compatibility with the deterministic priority and retain deterministic content when incompatible.

## Task 6: Verify the integrated redesign

**Files:** all changed files

**Steps:**

1. Run the readiness unit tests.
2. Run focused ESLint on changed TypeScript/TSX files.
3. Run `pnpm typecheck`.
4. Run `pnpm build`.
5. Run `git diff --check` and inspect the scoped diff around existing user changes.
6. Open authenticated Analytics in Chrome and verify desktop/mobile layout, live values, interactions, drill navigation, missing-data states, and reduced motion.
