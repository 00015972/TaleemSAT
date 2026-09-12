# Grid-In Grading and API Validation Design

**Date:** 12 September 2026  
**Audit scope:** B06 from `docs/launch-audit-2026-09-11.md`

## Objective

Close the B06 release gate by making grid-in grading accept only complete supported numeric responses and by enforcing bounded runtime validation at the application API boundaries named by the audit.

The implementation must preserve the answer-key protection from Step 03 and the mock-test development restriction from Step 02.

## Non-goals

- Re-enable mock tests or restore the retired mock grading handler.
- Change grading tolerance beyond removing numeric-prefix parsing.
- Redesign the practice, settings, or administration interfaces.
- Implement the separate navigation, duplicate-submission, taxonomy, sanitization-order, or transactional findings from B07 and D06–D12.
- Add a database migration. This step constrains application inputs before existing database operations.

## Selected approach

Use a shared strict numeric parser for grid-ins, shared Zod schemas for request boundaries, and a small JSON parsing helper that preserves predictable response codes.

This is preferred over route-local guards because it keeps UUID, length, timing, enum, array, and null rules consistent. It is preferred over a generic route middleware framework because B06 does not justify replacing the existing route structure.

## Grid-in response grammar

A supported response is one complete numeric expression after trimming outer whitespace:

- a signed or unsigned integer;
- a signed or unsigned decimal, including forms such as `1.5`, `.5`, and `5.`; or
- one fraction whose numerator and denominator are signed or unsigned integers and whose denominator is nonzero.

Internal whitespace, commas, percent signs, scientific notation, mixed numbers, formulas, multiple slashes, and trailing or leading junk are invalid. Examples that must be rejected include `3abc`, `3 cats`, `3+7`, `1/0`, `1/2/3`, `Infinity`, and `NaN`.

Parsing must consume the entire string and return only finite numbers. Numeric equivalence remains supported with the existing small floating-point tolerance, so `3/2`, `1.5`, and `6/4` match. Arbitrary exact string matching is removed: both the submitted response and an accepted answer must satisfy the numeric grammar before they can match. Invalid accepted answers already present in storage are ignored during grading rather than widening what students can submit.

Student response and answer-key strings are bounded to 32 characters. The practice grid-in input will expose the same maximum to prevent avoidable oversized submissions, while the server remains authoritative.

## Authoring validation

Grid-in validation will trim accepted answers, reject empty or malformed forms, reject entries longer than 32 characters, deduplicate repeated forms, and cap the list at 16 entries.

The canonical `correctAnswer` must itself be a valid grid-in response and must be numerically equivalent to at least one accepted answer. This rule applies to manual question creation and editing, staged import-item editing, HTML import validation, and promotion revalidation through the existing shared `validateQuestion` path.

Multiple-choice behavior remains unchanged except for runtime shape and bounds validation at API boundaries.

## Runtime request schemas

Add focused Zod schemas under `lib/validation` and keep domain-level question checks in `lib/admin/question-validation.ts`.

### Practice answers

The practice answer body is a strict object containing:

- `questionId`: UUID;
- `selectedAnswer`: a nonempty string of at most 32 characters that is either `A`–`D` or a valid grid-in response;
- `timeTakenMs`: optional finite integer from 0 through 86,400,000;
- `recordAttempt`: optional boolean.

Authentication still happens before body parsing, and validation still happens before the server-only Supabase client is created.

### Mock submissions

The dormant mock submission schema accepts a strict object with 1–40 unique answer entries. Each entry has a UUID question ID, an `A`–`D` or valid grid-in response (or `null` for unanswered), and a nullable finite nonnegative integer time bounded to 86,400,000 milliseconds.

The active `/api/mock/submit` handler remains restricted. It must continue returning `401` or `403` before reading the request body or touching questions and attempts. The schema is tested independently and becomes the required boundary if mock grading is restored later.

### Profile updates

Add an authenticated same-origin profile endpoint for the settings form. Its strict body contains:

- `fullName`: trimmed string up to 100 characters, converted to `null` when empty;
- `targetSatScore`: nullable integer from 400 through 1600;
- `examDate`: nullable ISO calendar date;
- `marketingOptIn`: boolean.

The server derives the user ID from authentication and confirms that the update returns a row. The browser no longer supplies or controls the target user ID. The existing timezone endpoint receives a strict bounded schema and retains its IANA timezone semantic check.

### Administrator writes

Every JSON-based administrator mutation receives strict body validation and UUID validation for applicable path parameters:

- question create and update;
- question delete and bulk publish/archive/delete;
- user role/tier update;
- import-item update;
- import promotion;
- import-job deletion.

Question schemas bound rich-text fields, answer fields, tag arrays, options, enums, and nullable values. Bulk and promotion arrays reject duplicates, invalid UUIDs, empty lists, and lists above their route limits. The HTML upload route already has a 20 MiB file boundary and is not converted into a JSON schema.

Authorization remains ahead of body parsing for protected endpoints. Schema validation must occur before database reads or writes that depend on request values.

## Error contract

- Invalid JSON returns HTTP 400 with `{ "error": "INVALID_JSON" }`.
- A syntactically valid body that fails its runtime schema returns HTTP 400 with `{ "error": "INVALID_BODY" }` and stable field-level issue information where useful.
- Question content that has a valid runtime shape but violates authoring semantics returns the existing HTTP 422 `VALIDATION_FAILED` response and field errors.
- Invalid path identifiers return HTTP 400 before a database query.
- Authentication and authorization responses retain their existing status and body contracts.

The parser/helper will not expose raw Zod internals or echo submitted answer content.

## Data flow

For an authenticated JSON mutation:

1. Authenticate or authorize the caller.
2. Parse JSON, distinguishing malformed JSON from a schema mismatch.
3. Validate and normalize the body with the endpoint schema.
4. Run any domain-level semantic validation.
5. Create the appropriate Supabase client and perform the database operation.
6. Return the existing success contract or a stable route error.

For practice grading, the validated response is passed to the strict grid-in matcher only after the protected question key is loaded through the server-only client.

## Automated validation

Focused tests will cover:

- valid integer, decimal, signed, fraction, and reducible-fraction equivalence;
- trailing junk, formulas, invalid fractions, non-finite values, unsupported notation, whitespace abuse, and invalid stored accepted forms;
- practice UUID, answer, timing, boolean, null, unknown-key, and malformed-JSON cases, including proof that privileged access is not created first;
- mock array size, uniqueness, null answers, option/grid-in responses, timing bounds, and preservation of the pre-parse development restriction;
- profile field bounds, date validation, server-derived ownership, timezone validation, and missing-row behavior;
- administrator enums, UUIDs, arrays, option shapes, grid-in keys, and path identifiers;
- manual and imported question validation for malformed accepted and canonical answers.

Repository verification will run the complete TypeScript test suite, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`.

## Documentation

Create `docs/audits/2026-09-11/step-06-grid-in-api-validation.md` with the implemented boundaries, exact validation results, and any remaining limitation. Update the launch-audit implementation summary to link Step 06 without marking the separate B07 race conditions complete.

## Acceptance criteria

- `3abc`, `3 cats`, and `3+7` cannot match an answer of `3`.
- Legitimate integer, decimal, signed, and fraction equivalents still grade correctly.
- Non-finite values, zero-denominator fractions, malformed forms, and oversized answers are rejected.
- New or edited grid-in questions cannot store malformed canonical or accepted answers through supported authoring/import paths.
- Practice, profile, timezone, and JSON administrator mutations reject malformed runtime bodies before request-dependent database access.
- Settings updates are authorized by the authenticated server identity, not a browser-provided user ID.
- Mock routes remain unavailable and body-independent while their future submission contract is bounded and tested.
- Malformed JSON and invalid bodies receive predictable HTTP 400 responses.
- Focused tests, the full test suite, typecheck, lint, production build, and diff checks pass, or any unrelated pre-existing failure is recorded precisely.
