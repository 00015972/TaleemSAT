# Question Bank Practice Arcade — Approved Design

## Status

Approved by the user on 2026-08-29 after reviewing three browser directions and a refined hybrid mockup. The approved direction combines Option A's illustrated subject portals with Option C's Practice Arcade heading and category decks.

## Objective

Redesign the Question Bank browse screen so it feels like the approved Focus Arcade dashboard: energetic, tactile, and distinctly SAT-specific without reducing the speed or clarity of finding a practice topic. Preserve the existing subject, category, topic, search, difficulty, progress, and practice-session behavior.

## Scope

This work changes the Question Bank browse experience and its route-specific shell styling. It does not redesign the SAT question runner, change the taxonomy or database schema, or introduce a new mixed-subject session type.

The bottom recommendation continues to use the existing `focusSubject` calculation, which selects the subject with the lowest attempted-to-total ratio for the active difficulty. Its final copy must describe a recommended practice session rather than promise a mixed-subject or fixed-length session.

## Visual system

- Use the dashboard's deep forest canvas, Manrope typography, mint green, warm yellow, coral, cream, crisp borders, and tactile lower shadows.
- Theme the existing app sidebar only while the Question Bank browse screen is visible, matching the Focus Arcade dashboard without changing other routes or the full-screen practice runner.
- Use Reading & Writing green and Math yellow consistently in portals, category decks, tray accents, progress rings, and actions.
- Keep the subtle checker texture and controlled radial light used by the dashboard.
- Build the open-book, answer sheet, calculator, and decorative symbols with CSS and small inline SVG where needed. Decorative artwork is hidden from assistive technology and adds no image request.

## Page structure

1. The page header uses the approved copy:
   - Eyebrow: “Practice arcade”
   - Heading: “Pick a deck. Start a run.”
   - Supporting copy: “Build skills in short, satisfying rounds—your progress is always on the cabinet.”
2. Search and the All/Easy/Medium/Hard difficulty control remain immediately visible in the header.
3. Two large subject portals reproduce Option A:
   - Reading & Writing uses a mint card with a floating open-book and answer-bubble illustration.
   - Math uses a yellow card with a floating calculator illustration.
   - Each portal shows the filtered question total, attempted progress, progress bar, and a direct subject-practice action.
4. The “All SAT skill categories” cabinet reproduces Option C:
   - Reading & Writing and Math appear as two bordered shelves.
   - Their eight official categories appear as tactile deck cards with icon, name, attempted count, total count, and disclosure indicator.
5. Clicking a category opens one full-width topic tray immediately below both shelves. The tray contains the category title, aggregate progress, a practice-whole-category action, and every topic row with its progress bubble and count.
6. The bottom recommendation offers practice in the existing weakest-progress subject through a single prominent action.

## Category and topic interaction

- At most one category tray is open at a time.
- Clicking a closed category card opens its tray and marks the card active.
- Clicking the active card again closes the tray. The tray also has an explicit close control.
- The tray accent follows the subject: mint for Reading & Writing and yellow for Math.
- Clicking the tray's primary action starts practice for the whole category.
- Clicking a topic row starts practice for that topic.
- Category cards and topic rows with zero questions for the active difficulty remain visible but disabled and explain why through accessible text.
- Keyboard users can reach every card, close control, category action, and topic row. The disclosure control exposes `aria-expanded` and `aria-controls`.

## Search and difficulty behavior

- Difficulty counts continue to come from the existing `PracticeOverview` payload, so changing difficulty is instantaneous and does not refetch.
- Changing difficulty updates subject portals, deck cards, the open topic tray, progress values, disabled states, and the bottom recommendation.
- With an empty query, the shelves and the selected category tray behave normally.
- With a search query, the shelves stay in place so the page does not jump. Matching category cards are highlighted and nonmatching cards are visually subdued.
- A full-width search-results tray replaces the selected-category tray while searching. It groups all matching categories and topics, shows their filtered counts, and uses the same category/topic practice actions.
- Clearing the query restores the category that was open before the search began.
- A query with no matches shows a compact illustrated empty result inside the tray rather than removing the entire cabinet.

## Components and state

- `PracticeShell` remains responsible for switching between browse mode and the existing full-screen question runner.
- `PracticeBrowse` remains the client-side state owner for difficulty, query, the single active category id, and the pre-search active category id.
- The browse UI is decomposed into focused presentational pieces for the page header, subject portals, category shelves, topic/search tray, recommendation banner, and subject illustrations. The orchestration and practice callbacks remain in `PracticeBrowse`.
- Existing `PracticeScope`, `PracticeOverview`, `SubjectNode`, `CategoryNode`, `TopicNode`, and `CountsByDifficulty` types remain the data contract.
- `onStart` continues to receive only the existing subject, category, or topic scope plus difficulty. No API contract changes are required.

## Data flow

1. The server page authenticates the user and calls `computePracticeOverview` exactly as it does now.
2. The complete subject/category/topic tree and per-difficulty counts arrive in `PracticeBrowse` once.
3. Client state chooses the active difficulty and derives every displayed total through the existing `pick` helper.
4. Search, active tray content, zero-count states, and the weakest subject are derived locally with memoized selectors.
5. Subject, category, and topic actions pass an existing `PracticeScope` to `PracticeShell`, which fetches the manifest and opens the unchanged runner.

## Empty and error states

- No published questions produces a centered arcade-style empty state with a cabinet illustration and a clear message; controls that cannot work are disabled.
- A subject or category with no questions for the selected difficulty remains legible but cannot start a session.
- Search with no matches stays inside the category cabinet and provides a one-click clear action.
- Manifest loading, no-question, authentication, and network errors remain owned by the existing `PracticeShell` flow.
- Long Math topic names wrap naturally in the tray without overlapping counts or actions.

## Motion and accessibility

- The page enters with one restrained stagger across header, portals, and cabinet.
- Subject progress bars grow once on entry and when difficulty changes.
- The book and calculator float slowly; coral circles breathe; small symbols pulse.
- Category cards lift on hover, and the topic tray opens with a short downward reveal. Topic rows use a small horizontal response on hover.
- All continuous and entry motion is disabled by `prefers-reduced-motion: reduce`.
- Text and controls meet readable contrast on dark, mint, and yellow surfaces.
- Focus states use a high-contrast yellow or mint outline and are never conveyed by motion alone.
- Decorative art is `aria-hidden`; progress values and disclosure state are announced in text.

## Responsive behavior

- Desktop uses two subject portals, two side-by-side shelves, four category cards per shelf, and a two-column topic tray.
- Tablet stacks the subject portals if needed and can stack the shelves while retaining the single full-width tray beneath both.
- Mobile uses one column, two category cards per row, a one-column topic tray, full-width actions, and the existing off-canvas sidebar.
- The illustrations shrink or move behind the portal copy without obscuring text.
- Search and difficulty controls wrap below the heading and remain full-width on narrow screens.

## Implementation boundaries

- Primary files are `components/practice/practice-browse.tsx` and the scoped Question Bank section of `app/globals.css`.
- Add a small practice artwork component file only if it keeps `PracticeBrowse` materially easier to understand; do not refactor unrelated practice-runner code.
- Scope new selectors under a Question Bank root such as `.practice-arcade` and shell `:has()` selectors so the redesign cannot leak into admin, auth, or exam surfaces.
- Preserve all unrelated uncommitted work already present in the repository.

## Verification

- Run ESLint on every changed Question Bank and practice component.
- Run the repository TypeScript check.
- Run the relevant unit tests if present and a production Next.js build.
- In the authenticated browser, verify:
  - subject, category, and topic actions open the correct existing practice scope;
  - every difficulty updates counts and disabled states;
  - all eight categories open the correct set of 29 total topics;
  - searching by category and topic names produces correct grouped results;
  - closing and restoring trays works before and after search;
  - empty and zero-count states are readable;
  - desktop, tablet, and mobile layouts remain usable;
  - keyboard focus, disclosure semantics, and reduced-motion behavior work as specified.
