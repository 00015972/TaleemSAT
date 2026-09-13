# Step 06 — grid-in grading and API validation

Completed locally on 12 September 2026. This implements B06 of the [launch audit](../../launch-audit-2026-09-11.md). It does not represent a deployment or complete the separate B07 navigation and duplicate-submission gate.

## Grid-in grading

- Replaced numeric-prefix `parseFloat` behavior with a parser that consumes the complete response.
- Supported complete integers, decimals, and one integer fraction, including signed values and reducible fraction equivalents.
- Preserved numeric equivalence: `3/2`, `1.5`, and `6/4` match.
- Rejected formulas, trailing text, internal whitespace, comma formatting, percent notation, scientific notation, multiple slashes, zero denominators, non-finite values, and responses longer than 32 characters.
- Required stored accepted forms to pass the same parser before they can match, so a stale malformed key cannot make malformed student input correct.
- Applied the 32-character limit to the practice grid-in control as an early UI boundary; the server remains authoritative.

The reproduced inputs `3abc`, `3 cats`, and `3+7` now all fail against an accepted answer of `3`.

## Authoring boundaries

Shared question validation now requires every grid-in accepted answer and its canonical answer to use the supported grammar. It rejects empty, duplicate, oversized, malformed, or excessive accepted-answer lists and requires the canonical answer to be numerically equivalent to an accepted form.

The rule is reused by manual question creation/editing, HTML import validation, import-item editing, and promotion revalidation. Manual and import-review forms derive the canonical grid-in answer from the first accepted form before validation.

## Runtime API validation

Added a shared Zod request layer that distinguishes malformed JSON from a syntactically valid but invalid body:

- malformed JSON returns `400 INVALID_JSON`;
- schema failures return `400 INVALID_BODY` with stable field paths and messages;
- invalid route UUIDs return `400 INVALID_PATH_PARAMETER` before request-dependent database access;
- semantic question-quality failures retain `422 VALIDATION_FAILED`.

The following active mutations now use strict, bounded runtime schemas after authentication/authorization and before request-dependent database access:

- practice answer submission;
- profile settings update;
- profile timezone update;
- admin question create, update, delete, and bulk actions;
- admin user role/tier update;
- admin import-item update, promotion, and import-job deletion.

The schemas enforce UUIDs, permitted response forms, finite nonnegative timing, enums, null handling, exact object keys, text limits, and bounded unique arrays. The HTML upload route retains its existing form-data and 20 MiB file boundary.

Settings profile writes now go through `/api/profile`. The server derives the row owner from the authenticated identity, accepts only `fullName`, `targetSatScore`, `examDate`, and `marketingOptIn`, and confirms that the update returned a profile row. The browser can no longer select the target user ID for this write.

## Mock-test compatibility

Step 02 takes precedence while mock tests are unavailable. `/api/mock/submit` still returns `401` or `403` before parsing any body or touching questions/attempts. A strict, tested dormant submission schema defines the boundary required before that grading path can be explicitly restored: 1–40 unique question UUIDs, bounded nullable answers, and finite bounded timing.

## Validation

| Check | Result |
|---|---|
| Focused B06 and compatible practice/mock tests | 52 passed, 0 failed |
| Complete TypeScript test suite | 89 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Webpack production build | Passed with Next.js 16.3.4; generated `/api/profile` and retained all existing routes |
| `git diff --check` | Passed |

The focused tests cover complete numeric parsing, equivalence, malformed input, invalid stored accepted forms, authoring semantics, JSON error contracts, practice fail-fast ordering, profile ownership and normalization, mock restriction ordering, UUIDs, arrays, enums, timing, nulls, and unknown keys.

No production data or hosted configuration was changed. The tests establish application parsing and control flow; they do not independently validate browser behavior against a deployed environment.

## Result

B06 is complete locally. Grid-in grading no longer accepts numeric prefixes, supported authoring paths cannot store malformed grid-in keys, and the audit-named application write surfaces now have explicit bounded runtime contracts. The mock endpoint remains deliberately unavailable and body-independent until a separate decision re-enables that feature.
