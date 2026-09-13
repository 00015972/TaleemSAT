# Admin Import Review Audit Stream Revision

**Date:** 2026-09-07  
**Status:** Approved  
**Selected direction:** Option A — full-width Audit Stream  
**Supersedes:** The three-column focused-review workspace in `2026-09-07-admin-import-review-quality-cockpit-design.md`

## Purpose

Redesign the imported-question review page around continuous browser scrolling. Administrators should be able to scan many complete questions in sequence, select and approve groups, and handle exceptions inline without repeatedly navigating between a queue, a focused inspector, and a separate quality panel.

The page remains a professional admin review surface, but it no longer treats review as a one-question-at-a-time workflow.

## Goals

- Restore continuous vertical scrolling through all filtered questions.
- Remove the left Review queue and right Quality signals panels.
- Remove focused-question state and previous/next navigation.
- Keep both per-question actions and bulk selection/actions.
- Keep complete question context visible: figures, passages, choices, rationales, and validation warnings.
- Preserve regular-weight Manrope typography and imported inline bold/italic markup.
- Complete individual actions in place without moving the administrator to another question.
- Preserve scroll position while server actions refresh card data.

## Non-goals

- The import parser, validation rules, persistence schema, and promotion API contracts will not change.
- This revision will not add required per-question confirmations or a new approval wizard.
- It will not collapse questions behind accordions or introduce a masonry reading order.
- It will not remove individual edit, reject, or approve actions.

## Page structure

The existing route chrome, import title, progress indicator, and four summary metrics remain. Beneath them, the review workspace becomes:

1. A sticky stream toolbar.
2. A single full-width ordered list of complete review cards.
3. A compact bulk-action bar that appears only when one or more questions are selected.

The browser document is the scroll container. There is no nested queue scroll, focused inspector, quality rail, or previous/next navigation.

### Sticky stream toolbar

The toolbar remains visible beneath the admin header while reviewing a long import. It contains:

- Search within the import.
- Status filter: all, ready, needs attention, approved, and rejected.
- Visible-result count.
- **Select ready** control scoped to the currently filtered stream.
- Selected-question count.
- **Approve selected** when the selection is nonempty.

The toolbar may wrap on narrower screens without hiding its primary actions.

## Review card

Each filtered item renders as one self-contained card in source order.

### Card header

The compact header contains:

- Selection checkbox when the item is promotable.
- Source reference.
- Status.
- Question type.
- Difficulty.
- Category or topic when available.
- Validation state.

Validation details appear in the affected card. Healthy questions do not render placeholder quality boxes.

### Card content

The card displays, in reading order:

1. Passage when present.
2. Imported image or chart when present.
3. Full rich-text question stem and tables.
4. Answer choices or grid-in accepted answers.
5. Full answer rationale when present.

The correct answer uses a green border, marker, and label. The choice text itself retains a regular Manrope baseline unless source markup explicitly makes part of it bold or italic.

### Card actions

Every unresolved card keeps **Edit**, **Reject**, and **Approve** actions. Resolved cards show their final state and retain any existing link to the created question.

Actions live within the card and remain independent of selection:

- **Edit** replaces that card's preview with its inline editor.
- **Save changes** returns the same card to formatted preview.
- **Reject** updates the same card in place.
- **Approve** promotes the same card in place.
- None of these actions automatically select, focus, scroll to, or advance to a different card.

## Interaction and state behavior

The page-level component owns job refresh, filtering, selection, action loading states, and notices. Presentation is divided into focused units:

- `ReviewToolbar` receives filter and selection state and emits toolbar actions.
- `ReviewCard` receives one item plus action/loading state and emits edit, save, reject, approve, and selection events.
- `QuestionPreview` and `QuestionEditor` continue to own rich preview and edit presentation.
- Existing validation, status-pill, figure, table, and rich-text renderers are reused.

Removing focused-item state also removes keyboard shortcuts whose purpose was previous/next navigation. Native page scrolling and standard focus order become the navigation model.

### Filtering and selection

Search and status filters change which cards are rendered but do not discard selections outside the current filter. **Select ready** selects or clears promotable cards in the current filtered result only.

Bulk promotion clears successfully processed selections after the server response. Skipped or failed results are reported through the existing notice pattern.

### Scroll stability

Server refreshes must not reset the browser to the top or intentionally scroll another card into view. A card may change height as its state changes, but no automatic navigation is performed. Inline editing opens at the card's existing location.

## Feedback and failures

Page-level import errors and operation notices remain near the top of the stream. Per-card operations expose their own disabled/loading labels so it is clear which question is being saved, rejected, or approved.

On a request failure:

- The card stays in its current location and state.
- Inline edits remain available for retry.
- Selection is not silently cleared.
- The notice explains the failed operation without navigating away.

## Visual direction

The stream retains the existing emerald admin identity, fine grid texture, green/gold status language, and Manrope typography. The visual hierarchy shifts from a three-column cockpit to a calm document-review surface:

- Wide, readable cards with generous internal spacing.
- Compact administrative headers.
- Restrained borders and shadows between cards.
- Question content visually dominant over metadata.
- Sticky controls that feel attached to the document rather than a separate panel.

Animations are limited to the initial staggered card reveal, inline editor expansion, and brief in-place success confirmation. All motion respects `prefers-reduced-motion`.

## Responsive behavior

- Desktop: one centered full-width stream with comfortable maximum reading width.
- Tablet: the same single-column order, with a wrapping toolbar and condensed metadata.
- Mobile: full-width cards, stacked toolbar controls, and card actions sized for touch.
- No breakpoint reintroduces a drawer, queue, quality rail, or focused-question navigation.

## Accessibility

- The ordered stream uses meaningful list/article structure.
- Every checkbox has a question-specific accessible label.
- Status and validation are communicated in text, not color alone.
- Card actions have visible keyboard focus states and remain in logical DOM order.
- Notices use the existing live regions.
- Reduced-motion users receive state changes without decorative animation.

## Verification

Automated and manual checks must cover:

1. Search and each status filter.
2. Select-ready behavior within filtered results.
3. Bulk approval and selection clearing.
4. Individual edit/save, reject, and approve actions.
5. No automatic advance or programmatic scroll after card actions.
6. Correct rendering of figures, tables, MCQ choices, grid-in answers, rationales, and validation errors.
7. Rich-text bold and italic preservation.
8. Empty, loading, completed, and request-error states.
9. Desktop, tablet, and mobile layouts.
10. Light and dark themes.
11. Type checking, linting, production build, and browser inspection.

## Acceptance criteria

The revision is complete when all imported questions can be reviewed by normal page scrolling; Review queue, Quality signals, focused-review navigation, and previous/next controls are absent; individual and bulk actions both work in place; and actions never force the administrator to another question or reset the page scroll position.

