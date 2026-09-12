# Grid-In Grading and API Validation Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-12-grid-in-api-validation-design.md`

**Goal:** Close audit gate B06 by replacing numeric-prefix grid-in grading with a complete numeric grammar and enforcing bounded runtime validation on practice, profile, mock-contract, and JSON administrator inputs.

**Constraints:** Preserve Step 02's pre-parse mock restriction and Step 03's server-only answer-key boundary. Do not include B07 race handling or the separate D06–D12 database and authoring workflow changes.

## Task 1: Implement and test strict grid-in parsing

**Files:**

- Modify `lib/grading/grid-in.ts`
- Create `lib/grading/grid-in.test.ts`
- Modify `components/reading/grid-in-input.tsx`

**Steps:**

1. Parse only complete integer, decimal, or one-fraction forms.
2. Reject non-finite values, zero denominators, internal whitespace, unsupported notation, formulas, and trailing junk.
3. Require both submitted and stored accepted forms to parse before numeric comparison.
4. Retain reducible-fraction and decimal equivalence within the existing tolerance.
5. Bound the browser input to the server answer-length limit.

## Task 2: Add shared request-validation primitives and schemas

**Files:**

- Create `lib/validation/request.ts`
- Create `lib/validation/schemas.ts`
- Create `lib/validation/schemas.test.ts`

**Steps:**

1. Add a JSON helper that distinguishes invalid JSON from invalid runtime shape without echoing submitted content.
2. Define reusable UUID, response, timing, enum, text, option, array, and date schemas.
3. Define strict schemas for practice answers, dormant mock submissions, profile/timezone updates, questions, bulk actions, user updates, import-item edits, and promotions.
4. Add uniqueness and cross-field checks where required.
5. Test accepted normalization and every required rejection class.

## Task 3: Strengthen shared question semantics

**Files:**

- Modify `lib/admin/question-validation.ts`
- Create `lib/admin/question-validation.test.ts`
- Modify `lib/import/html-validate.ts` if its adapter needs normalized fields

**Steps:**

1. Validate every grid-in accepted answer with the strict grammar.
2. Validate the canonical grid-in answer and require it to match an accepted value numerically.
3. Reject duplicate, oversized, or excessive accepted-answer lists.
4. Preserve existing MCQ and content feedback.
5. Cover manual, imported, and stale-invalid-key cases with pure tests.

## Task 4: Apply schemas to student routes and settings

**Files:**

- Modify `app/api/practice/answer/route.ts`
- Modify `app/api/practice/answer.test.ts`
- Create `app/api/profile/route.ts`
- Create `app/api/profile/route.test.ts`
- Modify `app/api/profile/timezone/route.ts`
- Modify `components/settings-form.tsx`
- Modify `app/(app)/settings/page.tsx`

**Steps:**

1. Validate practice submissions after authentication and before privileged client creation.
2. Add an authenticated profile update route that derives ownership from the session and confirms one returned row.
3. Send settings changes through that route and preserve existing UI feedback.
4. Apply bounded timezone validation.
5. Test malformed bodies, ownership, database errors, and successful normalized writes.

## Task 5: Apply schemas to administrator mutations

**Files:**

- Modify `app/api/admin/questions/route.ts`
- Modify `app/api/admin/questions/[id]/route.ts`
- Modify `app/api/admin/questions/bulk/route.ts`
- Modify `app/api/admin/users/[id]/route.ts`
- Modify `app/api/admin/import-jobs/[id]/items/[itemId]/route.ts`
- Modify `app/api/admin/import-jobs/[id]/promote/route.ts`
- Modify `app/api/admin/import-jobs/[id]/route.ts`

**Steps:**

1. Validate route UUID parameters before request-dependent database access.
2. Replace JSON type assertions and route-local shape guards with strict shared schemas.
3. Preserve semantic 422 authoring errors and existing success/failure response contracts.
4. Enforce bounded unique arrays and nullable field behavior.
5. Keep authorization before body parsing on every protected route.

## Task 6: Preserve and verify the mock restriction

**Files:**

- Modify `app/api/mock/access.test.ts` only if added assertions are useful
- Use the mock submission schema from `lib/validation/schemas.ts`

**Steps:**

1. Keep the active mock endpoints body-independent and database-independent.
2. Prove the dormant submission schema rejects oversized, duplicate, malformed, or invalidly timed answers.
3. Keep valid client-shaped submissions covered for a future explicit reactivation.

## Task 7: Validate and document B06

**Files:**

- Create `docs/audits/2026-09-11/step-06-grid-in-api-validation.md`
- Modify `docs/launch-audit-2026-09-11.md`

**Steps:**

1. Run focused grid-in, schema, practice, profile, admin-validation, and mock tests.
2. Run the complete TypeScript test suite, `pnpm typecheck`, `pnpm lint`, and the webpack production build.
3. Run `git diff --check` and review every request boundary for authorization/validation ordering.
4. Record exact results and limitations without marking B07 complete.
5. Link Step 06 from the launch-audit implementation summary.
