# Authoritative, Retry-Safe Practice and Mock Attempts

**Audit item:** B08 in `docs/launch-audit-2026-09-11.md`

**Status:** Approved on 12 September 2026

## Goal

Make the server authoritative over which student responses become historical attempts. A practice run records the first checked answer to each question once per server-issued run, while later guesses in that run remain unrecorded learning retries. A later practice run may record a new first answer to the same question. A mock run records exactly one final result for every question assigned to the run, including unanswered questions.

Both flows must be safe when requests overlap, a response is lost after commit, or the follow-up progression display cannot be loaded.

## Scope

This change covers:

- server-issued practice and mock sessions;
- immutable server-owned question rosters and per-question submission identifiers;
- removal of the client-controlled `recordAttempt` decision;
- atomic practice first-answer claiming and mock finalization;
- exact replay after a lost or repeated response;
- successful grading responses when only progression display loading fails;
- client integration, validation, database types, API documentation, tests, and an audit completion record.

Mock routes remain unavailable behind the existing launch restriction. Their secure start and finalization paths are implemented behind that gate and tested so re-enabling mocks does not restore the audited behavior.

This change does not add solution display, practice completion summaries, mock availability, or new scoring rules. Those remain separate audit items.

## Chosen approach

Use shared server-issued assessment sessions backed by immutable session-question rows and transaction-oriented database functions. This makes the first accepted practice answer and the one-time mock finalization database invariants rather than conventions enforced by React state.

Two alternatives were rejected:

- A client-generated run identifier plus a unique index would improve deduplication but would still let callers invent runs and choose which request is marked as the first answer.
- Inferring first answers from existing attempt timestamps would not bind questions to a particular run and would remain vulnerable to concurrent requests.

## Data model

Add an assessment-session table with a server-generated UUID, owner, context (`practice` or `mock`), lifecycle status, creation/completion timestamps, and bounded metadata describing the requested practice scope or mock configuration.

Add an assessment-session-question table with:

- the session and assigned question;
- an immutable position in the roster;
- a server-generated per-question submission UUID;
- the linked attempt ID after the authoritative response has been recorded;
- a uniqueness constraint for `(session_id, question_id)` and a global uniqueness constraint for the submission UUID.

Attempts gain a nullable session reference. Historical attempts remain valid. New practice and mock attempts created by these flows require both the session reference and the server-issued submission key. A unique `(session_id, question_id)` boundary makes one historical result per question per run unavoidable under concurrency.

`attempts.selected_answer` becomes nullable so a completed mock can store an unanswered assigned question honestly. Practice attempts continue to require a non-null response in the database function.

The tables use row-level security and expose no browser write policy. Session creation and attempt recording happen through narrowly granted functions or trusted server clients. Ownership is checked inside every write transaction.

## Practice flow

The practice manifest endpoint creates a session and its complete ordered roster in one database operation. Its response adds `sessionId` and a `submissionId` to every manifest entry while continuing to return the first student-safe question.

The answer request contains only `sessionId`, `submissionId`, `selectedAnswer`, and optional bounded timing. It does not accept `recordAttempt` or a caller-selected question ID. The route resolves the question from the owned session row, reads the grading key through the server-only client, grades the submitted response, and calls an atomic database function.

The function locks the session-question row:

- If no attempt is linked, it inserts the first answer and links the attempt in the same transaction.
- If the same submission payload is retried, it returns the stored attempt without inserting.
- If a different answer arrives after the first, it leaves the stored attempt unchanged and reports that this request is a learning retry.

The response distinguishes the current guess result from the stored first result. The runner uses the server response—not in-memory `firstResult`—to update historical correctness. Later guesses can still be graded and solved locally, but cannot change the stored first answer. An interrupted request preserves its exact pending payload until a definite response arrives.

Starting or reloading into a newly generated practice run creates a new session. That run may record another first answer to a question seen in an earlier run; the existing progression ledger still awards XP only for the user's first-ever attempt to that question.

## Mock flow

The mock start implementation creates a server-owned session and immutable roster before returning student-safe questions. The existing public route gate remains the first check and continues to return `403 MOCK_IN_DEVELOPMENT` without reading questions or writing session data while mocks are disabled.

Final submission sends the server-issued session ID and answers keyed by the assigned submission IDs. The server loads the authoritative roster rather than trusting the caller's list or total, validates that every supplied identifier belongs to the session, and treats omitted answers as unanswered.

A single database function locks the session, inserts one mock attempt for every assigned question, links the attempts, and marks the session complete atomically. Unanswered rows store `selected_answer = null` and `is_correct = false`. Repeating finalization returns the already-linked attempts and never changes totals or answers. The route reconstructs scoring and explanations from the authoritative roster and saved attempts.

The secure start/finalize implementation is placed behind the availability gate and covered directly by tests so it is ready when the gate is deliberately removed.

## Failure handling

Database functions provide the commit boundary. A request cannot commit an attempt without linking it to its session question, and a mock cannot partially finalize.

If the database call itself returns an ambiguous transport failure, the route reconciles through the owned session and server-issued submission identifiers before deciding whether the save failed. A committed row is returned as success; absence of a committed row remains a retryable save failure.

Progression event creation remains part of the attempt-insert transaction through the existing trigger. Loading the progression snapshot is follow-up display work. If that read fails after a successful or reconciled save, the route returns HTTP 200 with the authoritative grading result, `progression: null`, and a display-only warning indicator. Practice and mock clients accept the grading result, clear their pending submission state, and show a non-blocking progression-unavailable message instead of inviting a duplicate write.

Authentication, malformed input, foreign session ownership, identifiers outside the session roster, and closed or invalid session state return stable 4xx errors without grading an unrelated question or inserting an attempt. Persistence failures with no reconciled result return a sanitized 5xx error.

## Testing

Database-oriented tests or verification scripts cover:

- session ownership and immutable roster membership;
- one practice attempt per session/question under sequential and concurrent calls;
- exact replay returning the original result;
- a changed practice answer being graded as an unrecorded learning retry;
- a later practice session recording a new first answer to the same question;
- one mock attempt per assigned question, including unanswered questions;
- atomic mock finalization and replay after completion;
- existing progression uniqueness across repeated sessions.

Route and client tests cover:

- rejection of legacy `recordAttempt` and client-selected question identity;
- deriving question identity from the server-issued session submission;
- preservation of an indeterminate pending request payload;
- accepting a saved answer when progression loading fails;
- retrying only when persistence is genuinely indeterminate;
- authoritative mock totals despite omitted or reordered request answers;
- the current mock 403 gate performing no question or session work.

Repository verification includes focused tests, the complete test suite, type checking, linting, a production build, and `git diff --check`. Database application and live verification are reported separately and are not claimed if the configured project cannot be reached safely.

## Acceptance criteria

- The practice answer contract has no caller-controlled recording flag or question identity.
- Exactly the first checked answer for each question in a server-issued practice run is stored.
- Learning retries cannot alter the stored first answer.
- A later server-issued practice run may store a new first answer to the same question.
- Mock finalization records exactly one result for every server-assigned question, including unanswered questions.
- Replaying practice or mock submissions does not add attempts or change totals.
- Overlapping submissions resolve to one authoritative stored result.
- A committed attempt returns a successful grading response even if progression display loading fails.
- Existing first-ever-question XP uniqueness remains unchanged.
- Disabled mock routes continue to return 403 without question reads or writes.
