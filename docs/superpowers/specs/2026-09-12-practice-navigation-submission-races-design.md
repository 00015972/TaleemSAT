# Practice Navigation and Submission Race Safety

**Date:** 2026-09-12  
**Audit item:** B07 — Prevent practice navigation and duplicate-submission races

## Goal

Make practice navigation and answer submission deterministic under slow or failed networks. The question visible to a student must always be the question whose identifier and answer are submitted, and retrying the same first-answer request must never create a duplicate attempt.

## Current failure modes

`ReadyPracticeRunner` changes the manifest index before its question request finishes. Multiple unresolved navigation requests can finish out of order and replace the displayed question with an older response while the index points elsewhere. `checkAnswer` reads the question identifier from that index instead of from the displayed question.

Question prefetches and foreground loads are not deduplicated. The keyboard handler can also call `checkAnswer` more than once before React commits the `checking` state update. Finally, a response that is saved by the server but lost in transit can be retried as a new attempt because attempts have no client submission identifier.

## Scope

This change includes:

- stale-navigation suppression;
- in-flight question-fetch deduplication;
- explicit question-load failure and retry UI;
- a displayed-question identity check before selection and submission;
- a synchronous client submission guard;
- a stable, database-backed submission key for a question's first scored answer;
- safe replay behavior in the practice answer API;
- focused automated tests and throttled-network verification;
- a Step 7 audit-results document.

This change does not include:

- the broader server-owned practice-session model from audit item B08;
- changing the current first-answer scoring definition;
- persisting unscored learning retries;
- redesigning the practice interface or question manifest;
- making progression reads transactional with attempt insertion, which remains part of B08.

## Design

### Question identity and navigation

The runner continues to update the selected manifest index immediately so the navigator responds without waiting for the network. It also assigns every foreground navigation a monotonically increasing request identity. Only the latest request may commit question, loading, error, or timer state. A late response remains eligible for the cache but cannot replace the visible question.

The visible question is valid only when `current.id` equals the identifier at the selected manifest index. Answer controls and submission remain disabled until that invariant is true. Submission captures `current.id` and the selected answer together; it never derives the submitted identifier independently from mutable navigation state.

Navigating while an answer submission is in flight is allowed. The submitted values are captured before the request starts, and its result is stored under the captured question identifier. It must not clear a selection, show an error, or otherwise mutate transient controls belonging to a different question.

### Question loading

Question loading uses the existing resolved-question cache plus an in-flight promise map, both keyed by question identifier. Foreground navigation and prefetching call the same loader. When a request already exists for an identifier, callers share that promise instead of starting another request. The in-flight entry is removed when the request settles; successful results enter the resolved cache.

A foreground failure sets a load-error state only if its request is still the active navigation. The selected navigator position remains visible, and the question pane shows a concise error with a Retry action. Retry starts a new request for the same active entry. Stale failures are ignored.

### Client submission guard and key lifecycle

React's `checking` state continues to drive disabled styling and status text, but a ref provides the synchronous mutual-exclusion boundary. `checkAnswer` returns immediately when the ref is already locked and acquires the lock before its first asynchronous operation. The matching request releases it in `finally`.

Each question receives one pending first-submission payload containing its question identifier, selected answer, initial elapsed time, and submission key. The browser generates the key with `crypto.randomUUID()` immediately before the first request and retains the whole payload in a ref-backed map keyed by question identifier. If that request throws, times out, or returns an indeterminate server failure, retrying reuses every captured value, including the original elapsed time. A successful first-answer response fixes the existing `firstResult` state and removes the pending payload; later learning retries remain unrecorded under the current behavior and do not need submission keys.

Changing the selected answer after an indeterminate first request is not allowed until the request resolves or returns a definite failure. Returning to that question restores the pending answer selection so Retry sends the same payload. This prevents one key from representing two payloads. Validation or authentication failures are definite failures and may clear the pending payload because no attempt could have been written.

### Database model

Add a nullable UUID `submission_key` column to `attempts` and a unique index on `(user_id, submission_key)`. It is nullable so historical rows and attempt-producing flows outside this Step 7 scope remain valid; PostgreSQL permits multiple nulls in this unique index. New recorded practice submissions require a key at the API boundary.

The migration is additive and does not backfill historical attempts. Drizzle schema and generated Supabase types are updated to describe the new column.

### API idempotency

The practice answer request adds `submissionKey`. For `recordAttempt: true`, the route validates it as a UUID before privileged database access. Unrecorded retries do not require a key.

The route grades the answer, then attempts to insert an attempt with the key. On success, it loads progression from the new attempt as it does today. When insertion reports the unique `(user_id, submission_key)` conflict, the route loads the existing attempt owned by that user and compares its question identifier, selected answer, timing value, and practice context with the incoming request.

- If the stored payload matches, the request is an exact replay. The route returns the stored correctness and loads progression using the stored attempt identifier without inserting again.
- If the stored payload differs, the route returns `409 SUBMISSION_KEY_REUSED` and does not expose grading information for the new payload.
- If a different database error occurs, the existing save-failure response remains.

The unique index is authoritative under concurrent requests. A read-before-write optimization is unnecessary and cannot replace the constraint. A replay has the same grading and progression semantics as the original successful response.

## Error handling

- Stale question responses and errors update only the shared cache, never the visible question state.
- A current question-load failure shows Retry rather than an indefinite skeleton.
- A submission transport failure preserves the captured answer and submission key so the student can safely retry.
- A completed submission updates per-question state by captured identifier, even if the student has navigated elsewhere.
- A key-reuse conflict is a definite client error and never creates another attempt.
- A progression read failure remains distinguishable from an attempt-save failure. Making a committed attempt return success when only progression loading fails belongs to B08.

## Testing

Focused client-side tests cover behavior isolated from the full exam interface:

- two navigations resolving out of order cannot display the stale question;
- concurrent foreground and prefetch calls for one identifier share one fetch;
- the submission boundary rejects a displayed/selected identifier mismatch;
- two synchronous submission calls acquire only one lock;
- an indeterminate retry reuses the same submission key.

Practice answer route tests cover:

- rejecting a recorded attempt without a valid submission key;
- inserting the key with a first recorded answer;
- replaying the same key and payload without another insert;
- recovering from a concurrent unique-index conflict by reading the winning attempt;
- returning `409` when a key is reused with a different payload;
- leaving unrecorded learning retries unchanged.

Repository verification includes focused tests, TypeScript checking, linting, and a production build. Manual verification uses throttled requests to exercise rapid Next/Back/jump navigation, repeated Enter, a failed question fetch followed by Retry, and a retry after an interrupted answer response. Database-dependent verification is recorded honestly if the configured project is unavailable.

## Acceptance criteria

- The displayed question identifier always matches the active manifest entry before answer controls become interactive.
- Rapid Next, Back, and navigator jumps cannot let an older response replace the active question.
- One question identifier has at most one in-flight fetch.
- Repeated Enter or clicks cannot start concurrent client submissions.
- Retrying the same recorded submission key creates at most one attempt row and returns the original result.
- Reusing a key for a different payload returns a conflict and creates no row.
- A failed active question request shows a retryable error state.
- Existing per-question answers, flags, eliminations, highlights, timer behavior, and progression feedback continue to work.

## Deliverables

- runner changes and focused client logic tests;
- practice answer API and API test changes;
- additive SQL migration, Drizzle schema update, and Supabase type update;
- `docs/audits/2026-09-11/step-07-practice-navigation-submission-races.md` with verification evidence and remaining environment-dependent checks.
