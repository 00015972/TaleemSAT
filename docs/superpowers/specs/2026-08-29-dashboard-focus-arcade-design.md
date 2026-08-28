# Dashboard Focus Arcade — Approved Design

## Status

Approved by the user on 2026-08-29 after browser review of Option C and its refined target-score card.

## Objective

Replace the current dry student dashboard with the approved “Focus Arcade” direction: an energetic, dark forest interface with tactile depth, lively progress visuals, Manrope typography, and SAT-specific illustrations. The dashboard must continue to render real account, subscription, QOD, practice, and accuracy data.

## Visual system

- Use Manrope for headings, labels, values, and body copy.
- Keep a deep forest canvas with mint green, warm yellow, and coral as decisive accents.
- Give primary cards rounded corners, crisp borders, and a colored lower shadow that creates a tactile arcade-button effect.
- Use a subtle checker/noise atmosphere and controlled radial light without changing the rest of the product’s global theme.
- Theme the existing app sidebar only while `/dashboard` is present, leaving every other application route unchanged.

## Page structure

1. The welcome header introduces the current date, the student’s first name, and a concise progress prompt.
2. The hero grid contains:
   - A mint target-score card with the approved coral circle and floating SAT Plan paper artwork.
   - A larger accuracy card with a smooth, filled, animated line chart based on recent real attempts.
3. A three-card mission row summarizes streak, points earned this week, and daily task completion using illustrated objects rather than plain numbers alone.
4. Two subject cards summarize Math and Reading & Writing accuracy with animated rings and subject-specific artwork.
5. A lower activity area keeps the existing four-week activity heatmap, month totals, QOD status, and direct practice actions in the same visual language.

## Components and data flow

- `DashboardPage` remains a server component and owns authentication, profile/QOD queries, formatted labels, and data composition.
- `computeDashboardSnapshot` continues to aggregate attempts and adds `accuracyTrend`, a maximum 30-point series. Each point is the rolling accuracy of the latest five attempts at that moment, keeping the chart dense without inventing data.
- `AccuracyTrendChart` is an isolated client component responsible for curve geometry, entry animation, hover/focus state, and accessible point descriptions.
- Existing `Reveal` and `CountUp` components remain the motion primitives for scroll reveals and numeric transitions.
- Decorative SAT Plan, streak, XP, mission, Math, and Reading artwork is CSS/SVG-based so it stays crisp and does not add image-download cost.

## Empty and partial states

- Fewer than two attempts produce an illustrated chart empty state with a practice CTA; no fake trend is drawn.
- Missing target score or exam date changes the target card copy and keeps the settings action available.
- Missing QOD schedule produces a practice mission instead of a broken or empty action.
- Subject cards with no attempts show 0% and clearly say that no answers have been recorded.
- Query failures retain the current safe empty-array behavior in the dashboard aggregation.

## Motion and accessibility

- The chart line draws once, the area fades in, and points pop in sequentially.
- The SAT Plan paper floats gently; the coral circle breathes; small sparkles pulse.
- Streak, XP, mission, and subject illustrations use slow transforms rather than constant high-frequency movement.
- All motion is disabled by `prefers-reduced-motion: reduce`.
- Interactive controls retain visible focus states. Chart points support pointer hover and keyboard focus, and expose date, attempt number, and percentage labels.
- Decorative artwork is hidden from assistive technology.

## Responsive behavior

- Desktop uses a target/chart split, a three-card mission row, and paired subject/activity cards.
- Tablet stacks the hero cards, keeps the sidebar collapsed/off-canvas behavior, and uses two-column supporting cards where space permits.
- Mobile uses one column, moves the SAT Plan artwork away from copy, retains a readable chart viewport, and provides full-width actions.

## Verification

- Run ESLint on the changed dashboard, analytics, and component files.
- Run the repository TypeScript check.
- Run a production Next.js build.
- Open the authenticated dashboard in the browser and verify desktop and narrow layouts, real data labels, chart interaction, QOD states, settings/practice links, and reduced-motion behavior.
