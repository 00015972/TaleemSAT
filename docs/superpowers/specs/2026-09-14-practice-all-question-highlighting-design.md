# Practice All-Question Highlighting Design

## Problem

The Practice toolbar disables its highlight control whenever the current question has no `passage`. The renderer also makes only passage words annotatable. As a result, passage-less Reading questions and all Math questions cannot use the highlight tool, and question stems cannot be highlighted even when a passage exists.

## Scope

Enable highlighting for every successfully loaded Practice question. Students can highlight text in both:

- the passage, when one exists; and
- the question stem.

Answer choices, grid-in controls, charts, tables, toolbar content, and other interface controls are not highlightable. The existing yellow, blue, and pink colors, erase action, clear-highlights action, and per-question navigation persistence remain unchanged.

This change applies only to the Practice runner. The Mock runner is outside this fix.

## Design

### Toolbar availability

The Practice runner renders the highlight control for Reading and Math questions and disables it only while no current question is available, such as during loading or a load failure. Selecting the control toggles annotation mode for the current question.

### Annotatable regions

Refactor the existing Practice highlighter behavior into reusable annotation logic that can be attached to more than one content region. The passage keeps its current presentation. The question stem continues to use the established rich-text renderer so sanitized emphasis, lists, superscript/subscript, MathML, and table placement are preserved.

The annotation layer operates on eligible prose text without flattening or replacing the rendered rich-text structure. MathML and embedded non-prose elements remain renderable and are not rewritten into plain text. Selection and single-word interaction use stable region-local word indices.

### Highlight state

Store highlights per question and per region so identical word indices in the passage and stem cannot collide. A question's state has separate `passage` and `stem` highlight maps. Navigating away and back restores both regions. Clearing marks from the More menu clears every region for the current question and its count includes both regions.

Existing question state stays local to the active Practice session; no database persistence is added.

### Interaction rules

- When annotation mode is off, question selection and rendering behave as they do today.
- When annotation mode is on, students can select a run of eligible text and choose a color, or tap/click an eligible word to toggle the active color.
- Selecting or highlighting stem text does not alter answer selection.
- Answer choices and grid-in inputs preserve their current click, keyboard, and accessibility behavior.
- Moving between question types does not leave the tool incorrectly disabled or discard saved per-question highlights.

## Error and edge states

The highlight control is disabled while the current question is loading, missing, or failed. Empty passage fields do not matter because the question stem remains an annotatable region. A question with no eligible prose text may enter annotation mode without modifying charts, tables, or controls.

## Verification

Automated coverage should verify:

- the toolbar enables highlighting on a passage-less Reading question;
- the toolbar enables highlighting on a Math question;
- passage and stem highlights use independent state;
- clear-highlights removes and recounts marks from both regions;
- navigation preserves highlights per question;
- answer choices are not part of the annotatable region;
- rich text and MathML remain rendered rather than flattened; and
- loading and error states keep the tool disabled.

Run the relevant component tests, type checking, and linting after implementation. Perform a browser check of passage-based Reading, passage-less Reading, and Math questions in both light and dark themes.
