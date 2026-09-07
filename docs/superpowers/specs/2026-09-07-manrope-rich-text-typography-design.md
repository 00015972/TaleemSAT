# Manrope and Rich-Text Typography Design

**Date:** 2026-09-07  
**Status:** Approved  
**Selected direction:** Option A — typography token reset

## Purpose

Replace Playfair Display, Source Serif 4, and Literata throughout the runnable product and maintained design prototype with Manrope. Question content must use a normal-weight Manrope baseline while preserving intentional inline bold and italic markup from imported HTML.

The change must correct both sides of the publishing workflow: administrators should see accurate formatting while reviewing or editing imported questions, and students should see the same formatting in practice and mock-exam experiences after publication.

## Current behavior and cause

The import parser and write routes already retain safe rich-text tags. `sanitizeRichText` explicitly permits `b`, `strong`, `i`, and `em`, and `QuestionBody` plus option renderers insert that sanitized markup as HTML. Publishing an import copies those sanitized values into the question record.

The visible loss of emphasis is primarily a typography cascade problem. Several question stems, answer-choice containers, and preview surfaces assign medium or bold weights to their entire subtree. As a result, ordinary prose is rendered bold and an inline `b` element no longer has enough contrast to appear intentional. Serif-family tokens also continue to point at Source Serif 4 and Literata outside the student practice theme.

## Typography system

- Remove Playfair Display, Source Serif 4, and Literata from the application font import.
- Point the existing `--serif`, `--serif-body`, and `--serif-read` compatibility tokens to Manrope. Keeping the token names avoids an unrelated component rewrite while ensuring every consumer receives Manrope.
- Update the matching Tailwind font-family entries so utility-based pages cannot reintroduce the removed fonts.
- Update the maintained standalone landing-page prototype and active design-system documentation to describe and use Manrope.
- Retain purpose-specific families that are outside this request, such as JetBrains Mono for technical identifiers and the existing sans-serif families used by interface chrome.
- Historical dated design specifications remain historical records; the present specification supersedes their serif recommendations.

## Rich-text behavior

Question prose, passages, answer choices, and rationales use a `400` weight baseline. Interface-only elements such as question numbers, status labels, option-letter circles, and action buttons may keep their existing stronger weights.

Within rich question content:

- `b` and `strong` render at a clearly bold Manrope weight.
- `i` and `em` render italic/oblique without changing the surrounding text.
- Nested markup such as `<b>62 + 58 + <i>x</i> = 180</b>` remains both bold and italic where appropriate.
- `sup`, `sub`, lists, tables, SVG charts, and MathML retain their existing behavior.
- Correct-answer state is communicated by the row treatment and badge, not by forcing all option text bold.

No sanitizer allowlist expansion is needed. The implementation must not weaken the existing security boundary or convert rich HTML to plain text.

## Surfaces in scope

- HTML import parsing and import-review cockpit
- Admin question create/edit assessment preview
- Admin question listings and older import preview styles
- Student question-bank practice runner
- Student mock-exam runner
- Passage and rationale renderers shared by those experiences
- Global and Tailwind typography tokens
- Maintained standalone landing-page prototype

## Verification

Automated checks will cover the sanitizer with mixed bold, italic, and nested markup, verifying that allowed tags survive and unsafe markup remains removed. Existing type checking, linting, and production build checks must remain green.

Browser verification will confirm that:

1. Ordinary question, option, and rationale text is visibly regular-weight Manrope.
2. Only source-marked bold spans are bold.
3. Source-marked italic spans remain italic, including italics nested inside bold equations.
4. Formatting is consistent in admin review, admin preview, practice, and mock-exam surfaces in light and dark themes where applicable.
5. No request for Playfair Display, Source Serif 4, or Literata remains in runnable application styles.

