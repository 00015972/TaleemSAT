# Analytics Score Observatory — Approved Design

## Status

Approved by the user on 2026-09-08 after browser review of three visual directions and a refined Score Observatory mockup.

## Objective

Replace the current generic Analytics layout with “Score Observatory”: a cinematic, action-oriented performance command center that extends the Dashboard’s Focus Arcade language. The redesign must preserve real account and practice data, make progress feel alive through purposeful motion, and convert every important insight into a useful next action.

The page must not present an uncalibrated 400–1600 SAT prediction. It will instead show a transparent Readiness Index from 0 to 100, while the student’s target SAT score remains a clearly separate destination.

## Visual direction

- Use the Dashboard’s deep forest canvas, mint, warm yellow, coral, cream, checker texture, rounded tactile cards, colored lower shadows, and Manrope typography.
- Make the 30-day Readiness trajectory the dominant visual, paired with a high-contrast mint Coach Signal card.
- Keep the interface dense enough to feel informative but preserve a single hierarchy: trajectory, action, supporting evidence, then skill detail.
- Theme the existing app sidebar while `/analytics` is present, matching the Dashboard route without leaking Observatory styles to other pages.
- Keep the page deliberately dark in both global theme modes, as the Dashboard already does.

## Page structure

### 1. Performance header

The header contains a date-aware eyebrow, the message “Your score is gaining altitude,” a concise explanation, and a destination pill. The destination pill shows the saved target SAT score and links to Settings. When no target exists, it says “Set score target.”

### 2. Readiness trajectory

The primary card shows:

- the current Readiness Index;
- its change from the comparable point 14 days earlier when enough history exists;
- a 30-calendar-day animated trajectory;
- goal-pace and evidence annotations derived from real data;
- pointer and keyboard tooltips with date, index, evidence level, attempt volume, and the factor that changed most;
- a “How readiness works” disclosure that explains the four factors and current contribution of each.

The trajectory represents the student’s state on each day, not that day’s raw accuracy. Days with no new attempt retain the previous state, avoiding misleading zero-value drops.

### 3. Coach Signal

The mint Coach Signal card highlights one deterministic priority category and a concrete focused drill. AI supplies the warm, tutor-like explanation and recommendation, but it does not select or numerically score the priority.

The call to action opens Question Bank with the matching category preselected and begins a focused set after normal question availability checks.

The card may show a deterministic scenario such as “Potential readiness gain: +N if 9 of the next 12 are correct.” The application computes `N` by appending that explicit hypothetical result to the current window and recomputing the index. The UI must state the scenario; it must never present the number as a guaranteed SAT-score gain.

### 4. Supporting evidence

Four compact cards summarize:

1. 30-day accuracy and its recent change;
2. 30-day practice volume;
3. reliable category coverage;
4. practice runway based on exam timing and recent cadence.

Practice runway status is derived only from active days in the latest seven days:

- four or more active days: `On pace`;
- two or three active days: `Steady`;
- zero or one active day: `Needs a session`;
- missing exam date: `Set test date` with a Settings link.

These labels describe practice cadence, not likelihood of reaching the target score.

### 5. Skill signals

The first row presents three visually distinct signals:

- `Power skill`: the strongest reliable category;
- `Rising`: the reliable category with the largest positive 14-day change;
- `Priority signal`: the highest-leverage weak category.

A category is reliable after at least three attempts in the trailing 30-day window. When no category qualifies for a role, the card becomes an evidence-building prompt rather than inferring from insufficient data.

The remaining category breakdown, subject balance, and activity history continue below in the same visual language so no existing analytical capability is lost.

## Readiness Index

The Readiness Index is deterministic, bounded from 0 through 100, and implemented as a pure function. It uses attempts in the trailing 30-day window ending at the evaluated day.

### Accuracy contribution — 0 to 50 points

Use a small-sample-adjusted accuracy with a ten-attempt, 60% prior:

```text
adjustedAccuracy = (correct + 6) / (attempts + 10)
accuracyPoints = adjustedAccuracy * 50
```

This prevents one correct answer from producing an implausibly high initial index. The prior’s influence naturally shrinks as real evidence grows.

### Momentum contribution — 0 to 20 points

Compare accuracy from the most recent 14 days with the preceding 14 days at the evaluated date:

```text
momentumDeltaPoints = round((recent14Accuracy - previous14Accuracy) * 100)
momentumPoints = 10 + clamp(momentumDeltaPoints, -10, 10)
```

If either comparison window has no attempts, momentum receives the neutral value of 10 and is labelled `Building comparison`.

### Coverage contribution — 0 to 20 points

```text
coverageRatio = reliableAvailableCategories / availableCategories
coveragePoints = coverageRatio * 20
```

`availableCategories` means College Board domain categories that currently contain at least one published practice question. A category is reliable after three attempts during the trailing window. The existing practice-overview RPC supplies the available taxonomy; no fixed denominator is hard-coded.

### Evidence contribution — 0 to 10 points

```text
evidencePoints = min(trailing30DayAttempts / 60, 1) * 10
```

The final index is the rounded, clamped sum of the four contributions. With zero attempts, the page does not display an index and shows the baseline-launch state instead.

### Evidence confidence

- `Low`: fewer than 20 trailing attempts or fewer than three reliable categories.
- `Medium`: 20–59 trailing attempts or three to five reliable categories.
- `High`: at least 60 trailing attempts and at least six reliable categories.

Confidence appears beside the index and in accessible chart descriptions. It is not a fifth weighted factor.

## Components and responsibilities

- `AnalyticsPage` remains a server component. It owns authentication, tier gating, profile loading, overview loading, safe error handling, and top-level composition.
- `computeAnalyticsOverview` continues to aggregate attempts and is extended with category identifiers/slugs, 30-day display data, 60-day comparison data, available-category count, active-day cadence, skill signals, and readiness output.
- `computeReadiness` is a separate exported pure function so current, historical, and counterfactual readiness all use exactly the same formula.
- `ReadinessTrajectory` is a client component responsible for SVG geometry, entry motion, hover/focus selection, and accessible descriptions.
- `ReadinessBreakdown` renders the formula disclosure and contribution bars. It receives computed values and performs no scoring itself.
- `CoachSignal` evolves the existing AI panel. It renders deterministic category/impact data immediately and progressively adds the cached or fresh AI narrative.
- `AnalyticsMetricCard` renders the four supporting evidence cards.
- `SkillSignalCard` renders power, rising, priority, and evidence-building variants.
- `FocusedDrillLink` creates a validated `/question-bank?category=<slug>&mode=focus` deep link.
- `QuestionBankPage` accepts the optional category and mode parameters, validates the category against `PracticeOverview`, and passes a safe initial selection to `PracticeShell`. Unknown or unavailable slugs fall back to the normal Question Bank landing state.

## Data and AI flow

1. The Analytics server page authenticates the user and loads profile, attempts, and the available practice taxonomy.
2. The server builds `AnalyticsOverview`, including the readiness series and deterministic priority signal.
3. The initial page renders complete meaningful analytics without waiting for AI.
4. `CoachSignal` requests `/api/ai/insights` after hydration.
5. The endpoint keeps its paid-tier check, minimum-attempt requirement, prompt hash, cached response path, daily compute cap, and PII-free summary.
6. The AI response adds explanation, relevant subtopics, urgency, and a study recommendation. If the returned category does not match the deterministic priority, the UI keeps the deterministic priority and uses only compatible narrative fields.
7. Old cached payloads remain safe because readiness and impact never come from cache or AI. A prompt-version field is added to the hash input so the new Observatory narrative does not reuse incompatible older prose.

## Empty, locked, partial, and failure states

- **Free tier:** render an animated Observatory preview, a concise benefit list, and an upgrade action. Do not expose paid analytics values.
- **No attempts:** render an illustrated “Launch your baseline” state with a Question Bank action; do not show a numeric Readiness Index.
- **Sparse history:** render the available index with `Low confidence`, show which evidence is missing, and avoid power/rising labels that lack three attempts.
- **Missing target score:** destination pill becomes “Set score target” and links to Settings.
- **Missing exam date:** practice runway becomes “Set test date” and links to Settings.
- **AI loading:** deterministic priority and drill action remain visible while a restrained narrative skeleton loads.
- **AI insufficient data:** explain how many additional attempts unlock the coach narrative; keep the deterministic signal.
- **AI unavailable or rate-limited:** show the deterministic recommendation and a quiet availability note. Cached insight remains preferred when permitted by the existing endpoint.
- **Analytics query failure:** catch the failure at the page boundary and render a contained recovery panel. Do not convert a database error into a false empty-history state.
- **Invalid focused-drill slug:** open the normal Question Bank browser without preselection.

## Motion and accessibility

- Use the existing reveal and count-up primitives where their behavior fits.
- Draw the trajectory once on entry, fade its area fill, and pop data points in sequence.
- Stagger the hero, evidence cards, section heading, and skill cards.
- Use gentle breathing and floating transforms for the Coach Signal artwork and annotation card.
- Use tactile hover lift and lower-shadow compression for actionable cards and buttons.
- Stop decorative animation and remove delayed reveals under `prefers-reduced-motion: reduce`; content remains immediately visible.
- Provide keyboard-focusable trajectory points, visible focus rings, text equivalents, semantic headings, and an SVG-level summary.
- Never rely on green, yellow, or coral alone: every skill and trend state includes a text label.
- Decorative artwork is hidden from assistive technology.

## Responsive behavior

- Desktop uses the large trajectory/Coach Signal split, four evidence cards, and three skill-signal cards.
- Tablet stacks the two hero cards, retains two-column evidence cards, and adjusts chart annotations to avoid collision.
- Mobile uses one column, a horizontally readable chart with simplified persistent labels, full-width drill actions, and artwork repositioned away from copy.
- The themed sidebar follows the existing off-canvas/collapsed behavior and preserves the mobile menu control.

## Verification

### Automated

- Add unit tests for zero attempts, small-sample adjustment, neutral momentum, positive/negative momentum clamps, coverage denominator, evidence cap, confidence thresholds, historical carry-forward days, and counterfactual drill impact.
- Test deterministic priority selection and the no-reliable-category fallback.
- Test focused-drill parameter validation and unknown-slug fallback at the relevant component or pure-function boundary.
- Run ESLint on all changed Analytics, AI, Question Bank, and shared-style files.
- Run the repository TypeScript check.
- Run a production Next.js build.

### Browser review

- Verify paid, free, empty, sparse, missing-goal, missing-date, AI-loading, AI-unavailable, and query-failure presentations.
- Verify desktop and narrow/mobile layouts in the authenticated application.
- Verify chart pointer and keyboard tooltips, formula disclosure, focused-drill navigation, Settings links, focus visibility, and reduced-motion behavior.
- Confirm real student values match server aggregates and that no screen describes readiness as a predicted or guaranteed SAT score.

## Scope boundary

This redesign does not build a calibrated SAT-score model, change subscription policy, alter question grading, or rebuild the Mock Test system. A 400–1600 estimate may be designed later only after full-test outcomes and a documented calibration method exist.
