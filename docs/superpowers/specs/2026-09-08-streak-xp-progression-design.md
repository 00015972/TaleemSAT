# Streak and XP Progression — Approved Design

## Status

Approved by the user on 2026-09-08.

## Objective

Restore the dashboard's Streak and XP systems without restoring Daily Questions. Progress must come from real SAT work recorded by the existing Question Bank practice and Mock Test flows. Opening the site, signing in, viewing the dashboard, revisiting an explanation, or retrying a familiar question must never award XP or qualify a streak day.

## Product rules

### Qualifying question

A question qualifies exactly once for a student: the first scored attempt ever recorded for that `(user, question)` pair.

- Practice and Mock Test attempts are eligible.
- Correct and incorrect first attempts both qualify.
- A later retry or a later appearance of the same question does not qualify, even in a different context or on a different day.
- A practice question's first submitted answer is the scored attempt. Finding the correct answer on an unlimited retry does not replace that first result.
- The server-graded attempt is authoritative. Client claims, page visits, navigation events, answer selections that were not submitted, and local state cannot grant progress.

### XP

Each qualifying question awards:

- 5 base XP for completing the first scored attempt.
- 5 additional XP if that first attempt is correct.

Therefore, an incorrect first attempt awards 5 XP and a correct first attempt awards 10 XP. Difficulty does not change the award in this version. XP is cumulative and does not decrease when a streak expires.

### Streak

A student's local calendar day qualifies after five qualifying questions are recorded on that date.

- Questions may be split between practice and mock tests.
- Accuracy is not a requirement for the streak.
- Crossing from four to five qualifying questions extends the streak once. More questions on the same date cannot extend it again.
- If the student's last qualified date was yesterday, the new qualified date increments the current streak.
- If no previous date qualified, or the last qualified date is older than yesterday, the new qualified date starts the current streak at one.
- When a student begins new qualifying work after a missed day, the persisted expired streak resets while the daily counter builds toward five.
- The dashboard derives an expired display value as zero when the last qualified date is older than yesterday. Merely rendering that value does not write activity or award anything.
- Longest streak is retained independently and never falls when current streak expires.

### Student timezone

Store an IANA timezone, such as `Asia/Tashkent`, on the student's profile. The authenticated application detects it with the browser and updates the saved value when needed; this profile update has no progression side effects.

Every progression event snapshots both the saved timezone and the local `activity_date` used when the event is created. A later timezone change affects future events only and does not regroup prior activity or rewrite streak history. Use `Asia/Tashkent` as the fallback for accounts that do not yet have a saved timezone, including the historical backfill.

## Recommended architecture

Use an immutable progression-event ledger as the source of truth, with daily and user-level summaries as rebuildable read models. This is preferred over calculating all XP on every dashboard request or storing unaudited counters only on `users`.

### `progression_events`

One row represents the single XP-eligible first attempt for one student and question. It stores:

- event ID;
- user ID;
- question ID;
- source attempt ID;
- source context (`practice` or `mock`);
- correctness snapshot;
- base XP;
- correct-answer bonus XP;
- total XP delta;
- local activity date;
- IANA timezone snapshot;
- creation timestamp.

Enforce a unique constraint on `(user_id, question_id)`. Also enforce uniqueness for the source attempt ID. These constraints are the final protection against duplicate requests, concurrent submissions, repeat mock tests, and a question appearing in both practice and mock contexts.

Students may read their own events for progress history. Browser clients may not insert, update, or delete them.

### `daily_progress`

Maintain one row per `(user_id, activity_date)` with:

- qualifying question count;
- XP earned on the date;
- whether the five-question streak threshold was earned;
- the timestamp when the threshold was first crossed.

This table is a fast read model for the dashboard and daily mission state. It must be reconstructable from `progression_events`; it is not an independent source of earned XP.

### User progression summary

Add the following profile fields:

- `timezone`;
- `total_xp`;
- `current_streak`;
- `longest_streak`;
- `last_streak_date`.

The numeric fields default to zero. Summary values are caches maintained from ledger events and must be recoverable through a rebuild operation.

### Atomic award path

An `attempts` insert remains the canonical proof that a student submitted a server-graded answer. A database-owned progression operation runs atomically with every new attempt:

1. Try to create the `(user, question)` progression event.
2. If the unique event already exists, finish without awarding XP or changing daily/streak state.
3. Snapshot the user's saved timezone and calculate the local activity date.
4. Add 5 base XP and, when the first attempt is correct, the 5 XP bonus.
5. Upsert the corresponding daily summary.
6. Reset an expired persisted streak when this is new activity after a missed day.
7. If the daily count crosses five for the first time, update current streak, longest streak, and last streak date.
8. Update total XP.

This operation should be attached to attempt creation at the database boundary so current and future server flows cannot accidentally record an attempt without applying progression. Attempts remain protected from direct browser inserts; the existing authenticated server routes continue to grade answers before inserting them.

If progression processing fails, the containing attempt insert must fail rather than leaving an attempt and rewards out of sync. Callers receive a retryable save error and must not show an earned reward until the server confirms it.

## Existing flow integration

### Practice answer

`POST /api/practice/answer` continues to grade the selected answer server-side. Only the first check in the runner writes an attempt; subsequent unlimited retries keep their current learning behavior but do not write progression.

After a successful attempt insert, the response adds an optional progression result containing:

- whether this was a first-ever qualifying question;
- base, bonus, and total XP awarded;
- today's qualifying count and goal of five;
- whether the streak extended on this answer;
- current and longest streak.

If the question was attempted in an earlier session or context, the result reports no award. Correcting an initially wrong answer later must not add the correctness bonus.

### Mock submission

`POST /api/mock/submit` continues to grade and record each answered published question. The progression operation evaluates every inserted attempt independently, but the unique ledger constraint ensures only never-before-attempted questions award XP.

The response includes the total XP newly earned by that submission, the final daily goal state, and which results were first-ever qualifying attempts. Unanswered questions award nothing.

### Future attempt sources

Any future SAT exercise that writes a legitimate `attempts` row inherits the same progression rules automatically. Non-SAT engagement features must not write synthetic attempts merely to grant XP.

## Dashboard and feedback

Restore the three-card Daily Momentum row from the prior Focus Arcade dashboard:

1. **Combo Streak** — current streak in days, longest streak as secondary context, and a status line explaining how many new questions remain to protect or extend today's streak.
2. **XP Collected** — XP earned in the student's current local week as the primary value and total lifetime XP as secondary context.
3. **Daily Missions** — three milestones based on today's qualifying-question count: one-question warm-up, five-question streak goal, and ten-question stretch goal.

The mission row must use `daily_progress`, not the dashboard's raw attempt count. Repeating known questions can still appear in general analytics, but cannot fill progression missions.

Suggested card states include:

- `5 new questions to start your streak` when no qualifying work exists today.
- `2 more new questions to extend your streak` when today's count is three and yesterday qualified.
- `Streak protected for today` after the fifth qualifying question.
- `No new XP — already attempted` when a familiar question is submitted.

After a confirmed first-ever attempt, show compact feedback near the answer result:

- `+5 XP` for an incorrect attempt;
- `+10 XP` for a correct attempt;
- daily progress such as `3/5 new questions`;
- a distinct but restrained celebration when the fifth question extends the streak.

Reward feedback must come from the API response rather than optimistic client calculation. Existing reduced-motion behavior applies to all celebrations and count animations.

## Backfill

Backfill all existing students before enabling live awards:

1. For every `(user_id, question_id)`, choose the earliest attempt using `created_at` with attempt ID as a deterministic tie-breaker.
2. Create one progression event from that attempt's stored correctness and context.
3. Use the student's current saved timezone, or `Asia/Tashkent` when absent, to assign historical local dates.
4. Rebuild every daily summary from those events.
5. Recompute total XP, current streak, longest streak, and last streak date chronologically.
6. Make the process idempotent so it can be safely resumed; unique constraints prevent double awards.

Deploy the schema and backfill as one controlled rollout. Live attempt progression must not be enabled until existing qualifying attempts have been represented, otherwise a repeat answer during the rollout could be mistaken for a first-ever attempt.

## Error handling and integrity

- Invalid or unpublished questions retain the current API errors and never reach attempt creation.
- A failed attempt/progression transaction returns a save failure; the client offers retry and shows no reward.
- A duplicate or concurrent submission resolves to one progression event and one XP award.
- Daily count and XP summary values must never be accepted from the client.
- Timezone strings are validated against supported IANA zones before storage. An invalid or absent value uses the fallback without blocking practice.
- Negative XP, manual XP adjustments, levels, redeemable rewards, streak freezes, difficulty multipliers, leaderboards, and purchased boosts are outside this version.
- Provide an admin-only rebuild mechanism that recomputes daily and user summaries from the immutable ledger without recreating ledger events.

## Analytics semantics

General performance analytics continue to use all stored scored attempts as they do now. Progression has a narrower definition: only the earliest attempt per student and question. UI labels must say `new questions` when showing XP/streak progress so students understand why a repeated question affects practice history but not XP.

The student's current local week is used for the XP card. The week starts Monday and is calculated using the saved timezone.

## Verification

### Database and unit coverage

- First incorrect attempt creates one ledger event, awards 5 XP, and increments the local daily count once.
- First correct attempt creates one ledger event, awards 10 XP, and increments the daily count once.
- A retry of either result awards zero and leaves all summaries unchanged.
- A practice attempt followed by a mock attempt for the same question awards once, and the reverse order behaves the same.
- Concurrent duplicate submissions produce one ledger event and one summary update.
- The fifth qualifying question crosses the threshold once and extends the streak once.
- The sixth through tenth qualifying questions add XP and mission progress but do not extend the streak again.
- Five questions on consecutive local dates increment current streak.
- New qualifying activity after a missed date resets the expired streak; reaching five starts it at one while longest streak remains intact.
- UTC timestamps around local midnight map to the correct saved-timezone date.
- A timezone change does not move historical events.
- Re-running the backfill or summary rebuild does not change earned results.

### API and interface coverage

- Practice responses distinguish 5 XP, 10 XP, and non-qualifying repeats.
- A correct retry after an initially wrong answer does not grant another 5 XP bonus.
- Mock summaries count only newly encountered answered questions.
- Dashboard cards show zero-safe empty states for a new student.
- The Streak, XP, and Daily Missions cards use progression counts rather than raw attempts.
- A page visit, refresh, sign-in, dashboard render, question load, or unsubmitted answer selection changes no progression state.
- Desktop and narrow dashboard layouts restore the three-card row without regressions.
- Reward announcements are accessible to screen readers, do not rely only on color, and respect reduced motion.

## Alternatives considered

### Derive everything from `attempts` on every request

This avoids new summary data, but repeatedly grouping an unbounded attempt history by first question and timezone would make dashboard reads increasingly expensive. It also makes audit and per-answer reward feedback less direct.

### Store counters only on `users`

This lightweight approach is easy initially, but it provides no immutable explanation for why XP was earned, is fragile under concurrent submissions, and makes repair or backfill difficult.

### Selected: ledger plus rebuildable summaries

The ledger gives exactly-once awards and an audit trail. Daily and user summaries keep dashboard reads small. Clear source-of-truth boundaries allow summaries to be repaired without inventing or duplicating XP.

## Out of scope

- Restoring Daily Questions or its scheduler.
- Awarding progress for visits or passive engagement.
- Levels, XP spending, shops, cosmetics, leaderboards, or social competition.
- Difficulty-based or speed-based XP.
- Streak freezes, grace days, or retroactive repair tokens.
- Removing repeat attempts from ordinary performance analytics.
