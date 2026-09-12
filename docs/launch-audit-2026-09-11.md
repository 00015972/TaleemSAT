# Taleem SAT launch audit — 11 September 2026

**Implementation update:** [Step 01 — framework security update](audits/2026-09-11/step-01-framework-update.md), [Step 02 — mock-test restriction](audits/2026-09-11/step-02-mock-test-restriction.md), [Step 03 — answer-key protection](audits/2026-09-11/step-03-answer-key-protection.md), and [Step 04 — authentication redirect validation](audits/2026-09-11/step-04-authentication-redirects.md) are complete locally. [Step 05 — signup confirmation and password recovery](audits/2026-09-11/step-05-auth-confirmation-recovery.md) is implemented locally, but its hosted URL, email-template, SMTP, rate-limit, and clean-browser delivery checks remain open pending access to the configured Supabase project. Next.js and its ESLint configuration are now 16.3.4; critical advisory records dropped to zero; mock tests are server-restricted; student access to grading keys is denied; authentication destinations are validated; and signup/recovery no longer depend on incomplete client-only transitions. The findings and measurements below describe the original `9bb0af5` audit baseline.

**Recommendation: prepare a limited free student beta. The current version is not ready for a paid public launch.** The core question bank, admin tooling, practice interface, and progression system exist. The immediate gaps are reliable learning feedback, grading and session integrity, authentication recovery, security verification, and a working public entrance. Another broad redesign would consume the two-day window without resolving these gaps.

This report is an audit and implementation backlog. Application behavior, database records, dependencies, and deployment configuration were not intentionally changed during the audit. In particular, **mock tests are still accessible to signed-in students; the requested “In development” restriction remains a launch task.** Only audit documents and evidence files were added.

The release recommendation assumes a free beta because the launch model was not specified. A paid launch also requires functioning checkout, entitlement lifecycle, billing support, and customer-facing policies; those are not implemented here.

## Scope, evidence, and limits

Audited baseline: commit `9bb0af5`. Inventory covered **289 tracked files**, including **124 TypeScript/TSX files in app, components, lib, and drizzle**, **19 page routes**, and **18 API route files**, plus the authentication callback. Review combined source and data-flow inspection, an AST import/reachability scan, configuration and migration review, production build inspection, browser checks, dependency advisories, and read-only database API checks.

Every tracked path is listed in [the file inventory](audits/2026-09-11/file-inventory.csv), with its review method. This is not a claim that every line of every skill, historical document, generated preview, or third-party dependency was manually proven correct. The deepest review focused on student journeys, privileged operations, grading, database access, and performance. Binary assets were inventoried; question answers were structurally checked, not all pedagogically solved.

| Check | Result | Practical limit |
|---|---|---|
| `pnpm typecheck` | Passed | Does not validate incoming JSON or database permissions |
| `pnpm lint` | Passed | Does not detect the behavioral defects below |
| `pnpm build` | Passed, production Next.js 16.2.6 | Local production build; no deployment performed |
| Existing readiness, date, and rich-text tests | 15/15 passed | No existing comprehensive API, auth, RLS, or browser suite |
| HTML import fixture | All 257 questions parsed in approximately 132 ms; no parser errors or structural flags | Read-only parse; no promotion or upload performed |
| Registry dependency audit | 67 advisory records: 2 critical, 32 high, 26 moderate, 7 low | Records include conditional and tooling vulnerabilities, not 67 demonstrated exploits |
| Live content scan | All 1,581 question records paginated and structurally checked | Does not prove answer accuracy or content rights |
| Anonymous Supabase reads | Sample reads of questions, users, attempts, and import items returned no rows | Does not establish authenticated student isolation or column permissions |
| Browser inspection | Landing, login, dashboard, question bank, practice entry, mock setup | Not a full browser/device matrix; no answers submitted or test emails sent |

The direct PostgreSQL catalog connection failed DNS resolution through the configured `DATABASE_URL`; Supabase REST worked. Consequently, live indexes, all RLS policies, column grants, and installed triggers could not be independently inspected. Railway was not linked to this checkout, so deployed region, CPU/memory, logs, backups, and production latency remain unverified. These are verification gaps, not evidence that the live database or hosting service is down.

Supporting evidence: [metrics](audits/2026-09-11/audit-metrics.json), [all dependency advisory records](audits/2026-09-11/dependency-advisories.csv), and [published content coverage](audits/2026-09-11/published-content-coverage.csv). These artifacts exclude credentials and raw student records.

## 1. Release gates

Treat the following as gates before inviting students. A verification gap can be closed by demonstrating the expected behavior; it does not automatically require a redesign.

### B01 — Patch the installed framework and review the resulting dependency tree

**Confirmed:** `package.json` pins Next.js and `eslint-config-next` to 16.2.6. The audit reports two critical Next.js advisories. One concerns AVIF processing in image optimization; another concerns Windows-hosted servers. The latter would not apply to a Linux deployment. Their patched Next.js 16 release is **16.3.3**. Use a current compatible patched release at least that new, align the Next ESLint package, and rerun the audit, build, and route smoke checks. Do not stop at 16.2.11 simply because an earlier proxy advisory was fixed there. [Next.js AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).

**Acceptance:** no unresolved applicable critical advisory; each remaining high advisory has a reviewed dependency path and remediation or applicability explanation. Avoid a blanket forced dependency upgrade immediately before release.

### B02 — Enforce the requested mock-test restriction on the server

**Confirmed:** `app/(app)/mock/page.tsx:6` renders `MockRunner` unconditionally. Both `app/api/mock/start/route.ts` and `app/api/mock/submit/route.ts` check authentication but do not restrict students. Browser inspection reached the setup screen.

**Required behavior:** `/mock` shows “Mock tests are in development” in the existing app shell, with a “Practice questions” link. Remove student start controls and add an “In development” navigation badge. Both API handlers must reject student calls before loading questions or recording attempts. If keeping an internal preview, allow it only through a server-side admin role check; a URL parameter, disabled button, or client feature flag is insufficient.

**Acceptance:** free, pro, and elite student accounts all see the notice; direct start/submit calls fail without creating attempts. Signed-out access remains protected. Any allowed admin preview works separately. Do not market this feature as available.

### B03 — Close or conclusively verify the answer-key boundary

**Confirmed code concern, live authenticated exploit not tested:** `app/api/practice/answer/route.ts:43` and `app/api/mock/submit/route.ts:50` read `correct_answer`, `accepted_answers`, and explanations using the user-scoped Supabase client. That client uses the same database role as a signed-in student's direct Supabase API access. Omitting answers from a custom route response does not by itself protect the underlying columns.

Move grading-key reads to a narrowly authorized server service/function, and deny student access to answer columns or a separate private answer table. Preserve access to published question content. Review policies for attempts, profiles, subscriptions, import data, and storage at the same time. The documentation's use of `user_metadata.role` for RLS authorization is unsafe guidance because user metadata is editable; the application's database-backed admin gate is the better existing pattern. [Supabase column security](https://supabase.com/docs/guides/database/postgres/column-level-security), [Supabase authorization metadata guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Acceptance:** using two non-admin accounts, direct API calls cannot read answer keys, drafts, other students' records, or mutate role/tier/XP. Grading still succeeds through the authorized server path. Do this in a disposable test environment, not by altering real student records.

### B04 — Validate authentication redirect destinations

**Confirmed:** `components/auth/login-form.tsx:34` pushes the `next` query value directly. `app/auth/callback/route.ts:31` constructs a redirect from an unrestricted `next`. External URLs are accepted by the callback; unsafe schemes are also a concern for client navigation. Next explicitly warns against passing untrusted URLs to router navigation. [Next.js router guidance](https://nextjs.org/docs/app/api-reference/functions/use-router).

Use one shared internal-path validator: allow intended local destinations, reject schemes, protocol-relative paths, backslashes, and malformed input, then default to `/dashboard`. Apply it at both entry points.

**Acceptance:** normal deep links work; external, `//host`, and executable-scheme destinations cannot be used. Callback failures produce a visible login error instead of silently losing the reason.

### B05 — Finish signup confirmation and password recovery

**Confirmed mismatch; complete email round trip not exercised:** signup always navigates to `/dashboard` after a successful `signUp`, even when email confirmation returns no session. Reset password waits exclusively for a browser `PASSWORD_RECOVERY` event, while the server callback has already exchanged the PKCE code. A fresh browser client may receive the initial session without that recovery event and remain on “Verifying your reset link…”. See `components/auth/signup-form.tsx:67`, `app/(auth)/reset-password/page.tsx:21`, and `app/auth/callback/route.ts`.

Handle session-present versus confirmation-required signup explicitly. Add a check-email state and resend feedback. Make reset readiness compatible with the actual SSR recovery flow, with expired/invalid-link handling; do not simply show an unrestricted reset form because a query parameter is present.

**Acceptance:** signup, confirmation, login, logout, forgotten password, reset, expired links, and repeat clicks pass on the production domain and a clean browser. Verify Supabase site URL, redirect allowlist, email templates, and delivery configuration.

### B06 — Correct grid-in grading and validate API input

**Reproduced:** `lib/grading/grid-in.ts:27` uses `parseFloat`, so `3abc`, `3 cats`, and `3+7` are accepted against the answer `3`. A TypeScript type annotation on request JSON does not reject runtime objects, nulls, or malformed arrays. Several endpoints can throw or accept invalid timing values.

Parse a complete allowed numeric representation, reject non-finite values and invalid fractions, and validate canonical/accepted answers when authoring. Define the supported SAT response conventions explicitly rather than relying on numeric-prefix parsing. Apply bounded Zod schemas to practice answers, mock submissions, profile updates, and admin writes: UUIDs, permitted option IDs, answer lengths, finite nonnegative timing, enum values, array limits, and null handling.

**Acceptance:** legitimate integer/decimal/fraction equivalence works; trailing junk and malformed bodies receive predictable 400 responses. Add focused tests for grading and runtime validation.

### B07 — Prevent practice navigation and duplicate-submission races

**Confirmed from control flow:** `components/practice/practice-runner.tsx:192` updates the manifest index before a question fetch completes. Overlapping requests can set `current` from an older navigation. `checkAnswer` then uses `manifest[index].id`, allowing a displayed question and submitted ID to diverge. The keyboard handler can call `checkAnswer` again while checking because the callback has no in-flight guard.

Give each navigation a request identity or abort stale requests; verify `current.id` matches the active entry before enabling submission. Deduplicate in-flight question fetches. Add a synchronous submission guard and server idempotency.

**Acceptance:** throttled network, rapid next/back/jump, repeated Enter, and retry after a response timeout never grade the wrong question or record duplicate attempts. A failed question fetch shows an error and retry action rather than an indefinite skeleton.

### B08 — Make recorded attempts authoritative and retry-safe

**Confirmed:** the student controls `recordAttempt` in the practice endpoint. A caller can probe correctness with `false`, then record only a correct response with `true`. A new session also resets the client's first-result memory. Both practice and mock routes insert attempts before reading progression; a failed progression read returns 500 even though the attempt was committed, inviting a duplicate retry.

Define server-owned practice sessions/submission IDs and the distinction between an initial scored answer and learning retries. Use a unique submission key and transaction/RPC where needed. Preserve a successful save outcome if only the follow-up progression display failed. Keep historical accuracy based on the intended first-answer definition.

**Acceptance:** replaying one submission does not change totals; callers cannot choose which guesses count. Existing XP uniqueness is preserved—it already prevents some duplicate awards, but it does not deduplicate the attempts table.

### B09 — Complete the learning loop with explanations

**Confirmed:** the practice API returns an explanation after a correct answer, but `PracticeRunner` consumes only correctness and progression. Students receive no explanation view there. Unlimited guessing without a reveal/skip learning action is particularly frustrating for grid-in questions.

Show the explanation after solving, and provide a deliberate “Show solution” action that records the question as not independently solved. Keep the first-answer result intact. Add a visible completion action and compact session summary.

**Acceptance:** both MCQ and grid-in practice lead to readable explanations, a next step, and an honest result. Verify rich text, tables, and formulas in this view.

### B10 — Ship a truthful landing page and a supportable release

**Confirmed:** `app/(public)/page.tsx` is still the Phase 0 foundation/status page. The finished-looking marketing reference is only `design/landing.html`. Payment processing and certificates described in the roadmap are absent; upgrade controls lead to “coming soon”.

Build the public page from the design reference with actual app links and only available features. Put unfinished features behind clear availability copy. Provide working help/contact and privacy/terms links with operator-reviewed content. Verify backup/restore and rollback procedures before accepting student data at scale.

**Acceptance:** a new visitor can understand the beta, sign up, practice, get help, and recover access without reaching a placeholder or a purchase dead end. Hosting and auth production settings are checked, and there is an identified person/process for support and rollback.

## 2. Why pages feel slow, and the order to fix them

The clearest measured delay is server waiting, with additional browser asset overhead. These are separate problems.

| Local production request | Three observed total times | Interpretation |
|---|---|---|
| `/login`, signed out | 22, 4, 4 ms | Its server render is fast locally; visual slowness here needs browser/network profiling |
| `/`, signed out | 2,389, 2,294, 2,425 ms | Almost all time was before the first byte; two sequential Supabase counts are in the render path |
| `/api/health` | 917, 470, 551 ms | A small Supabase-dependent request carries material remote latency |

Separate read-only Supabase requests from this machine took roughly 0.8–1.4 seconds in another sample. This measures network plus service work, not PostgreSQL execution time. It does not prove the same delay from a deployed server located near Supabase. No deployed p95, LCP, INP, CLS, or mobile CPU profile was collected.

| ID / priority | Finding and evidence | Recommended change |
|---|---|---|
| P01 / before launch | Landing creates a cookie-scoped client, disables revalidation, and awaits subject and category counts sequentially (`app/(public)/page.tsx:4`). | Make marketing content static. Remove live infrastructure counts from the visitor path. If a question count is displayed, refresh a public aggregate on a controlled schedule. |
| P02 / before launch | `computeDashboardSnapshot` issues four base requests, then two more per subject: eight requests for two subjects (`lib/analytics/dashboard-snapshot.ts:88`). Profile, timezone, progression, and auth add more work. | Return dashboard aggregates from one compact database RPC; combine profile/timezone when migration rollout is complete. Measure query timings. Do not globally cache private user data. |
| P03 / before launch | The app layout waits for profile/timezone; whole pages wait for all metrics. A page loading boundary cannot hide work above it in its layout. | Keep essential auth checks; stream independent dashboard sections through local Suspense boundaries. Use page-shaped skeletons and visible pending navigation feedback. |
| P04 / next | Analytics loads joined attempt history and recomputes summaries; its AI endpoint computes the overview again after hydration (`lib/analytics/overview.ts`, `app/api/ai/insights/route.ts`). | Use compact aggregate results, a bounded recent series, and a cached summary version. Avoid a second full history pass solely to find an existing insight. |
| P05 / next, especially for active import use | Admin import list fetches up to 50 jobs, then two counts per job: up to 101 requests (`app/(admin)/admin/import-jobs/page.tsx:50`). | One grouped aggregate/RPC for job counts; fetch list summaries together. More `Promise.all` does not remove the request multiplication. |
| P06 / next | Admin question list needs taxonomy, page results, and several global counts; import review sends complete content for every item and polls the full result. | Cache rarely changing taxonomy, group counts, paginate import summaries, lazy-load expanded content, poll job status/counts only. Keep client filters aligned with server pagination. |
| P07 / next | Promotion loops through items and performs multiple sequential reads/writes per item. | Transactional, bounded bulk promotion with deduplication. Progress reporting should reflect committed results. Do not increase HTTP timeouts as the only fix. |
| P08 / before launch, targeted | `app/globals.css` is 497,957 bytes and approximately 21,216 lines. Production shared CSS is 383,313 bytes, approximately 69,443 bytes gzip. It includes public, student, and admin designs. | Keep reset/tokens/shared shell global; move route styles into scoped files. Remove demonstrated obsolete blocks with visual checks. Prioritize obvious dead sections; defer a complete CSS rewrite. |
| P09 / before launch | Two CSS `@import` requests load five Google font families. Poppins alone requests 18 style/weight combinations (`app/globals.css:1`). | Choose a small shared type system, usually one UI family plus optional reading/mono face. Use `next/font` or local assets with only required weights. Avoid a late CSS-to-font discovery chain. |
| P10 / before launch if analytics unused | PostHog is statically imported by root `app/providers.tsx` even when its key is absent. A production chunk containing PostHog is 191,954 bytes raw / 62,766 gzip. | Load the optional integration only when configured, after essential UI work; or remove it for beta if no events are being used. Chunk size is a build measurement, not a complete browser transfer attribution. |
| P11 / next | Count-up/reveal effects, many observers, large previews, blur, and animations add browser work. | Profile an inexpensive phone; render meaningful numbers immediately, keep essential content visible, and retain reduced-motion support. Optimize observed expensive effects rather than removing all animation. |
| P12 / verify before launch | Server/database regions and actual indexes are unverified. SQL 010 already defines practice indexes and aggregation. | Inspect live indexes and query plans before adding more. Check service-to-Supabase latency and hosting region. Add request timing/error monitoring, then compare before/after on the deployed app. |

Useful existing work should stay: the practice overview is already a database RPC; server helpers already use per-request React `cache`; practice already prefetches neighboring questions; Desmos is loaded on demand; links already use Next navigation in many places. Next's automatic prefetch is a production behavior, with dynamic-route behavior affected by loading boundaries. Do not diagnose it solely in `next dev`. [Next.js prefetch documentation](https://nextjs.org/docs/app/guides/prefetching).

**Suggested performance acceptance targets:** visible navigation feedback within about 100 ms, no blank wait for independent cards, landing served without a database round trip, and meaningful reductions in dashboard request count and shared assets. Measure p75 LCP/INP/CLS on actual target devices after deployment; these are proposed goals, not scores already achieved. Never remove authorization to make pages faster.

## 3. Page-by-page redesign inventory

“Redesigned” means an identifiable current visual implementation exists; it does not mean all functionality or accessibility is complete.

| Route | Current state | Release action |
|---|---|---|
| `/` | Old Phase 0 placeholder; separate landing reference exists | Highest visual priority: implement `design/landing.html` as real Next components and correct its copy/links |
| `/login` | Basic older auth card | Bring into shared brand; fix labels, errors, redirect handling, and password visibility if added consistently |
| `/signup` | Basic older auth card | Same auth system; add confirmation-required success state |
| `/forgot-password` | Basic older auth card | Same auth system; clear sent/error/cooldown feedback |
| `/reset-password` | Basic older auth card; recovery readiness issue | Fix flow first, then style; support expired links |
| `/dashboard` | New dashboard design | Retain; improve loading, metrics, mobile controls, and rendering cost |
| `/question-bank` | New browse interface and exam-style practice runner | Retain; fix grading/races, explanations, session completion, empty/error states |
| `/analytics` | New analytics design; paid gate and locked/empty states | Retain visuals; make beta access coherent; correct data windows and insight costs |
| `/settings` | New settings design | Fix score normalization, verified status, refresh after saving, and upgrade dead end |
| `/mock` | Existing setup/runner/result flow, less aligned with current practice | Replace student entry with “In development”; defer runner redesign |
| `/admin` | Redirect to question management | No separate redesign needed |
| `/admin/questions` | New operations interface | Retain; aggregate counts, improve authoring metadata and error handling |
| `/admin/questions/new` | New guided authoring interface | Retain; add topic mapping and stricter validation |
| `/admin/questions/[id]/edit` | New editing interface | Retain; preserve/validate topic and imported metadata |
| `/admin/import-jobs` | New import list design | Retain; remove per-job count waterfall |
| `/admin/import-jobs/new` | New guided upload design | Retain; test limits and visible upload failures |
| `/admin/import-jobs/[id]` | Latest audit-stream review design | Retain latest implementation; older cockpit specs are historical |
| `/admin/users` | New user management design | Retain; test role changes and last-admin protection |
| `/admin/subscriptions` | Older generic admin layout; manual tier overview | Defer for free beta or clearly label manual access management; redesign when real billing exists |

Additional missing surfaces: custom error/retry pages, branded not-found page, working support/contact, privacy/terms, and an accessible question-report path. `/certificates` is referenced by protection/planning but has no implemented page. Admin settings is a disabled navigation entry. No audit-log viewer or full exam-authoring interface exists. Do not create all of these solely to fill the navigation; remove misleading links and expose only the beta scope.

For `design/landing.html`, replace `href="#"` placeholders, map login/signup/practice links, move the portrait to an appropriate served asset location, reuse the app's theme mechanism, and verify the mobile menu. The reference contains pricing and product promises that are not implemented. Its claim about 200+ platform students is not supported by the connected database's two accounts; teaching experience is a different claim and may be supportable separately. Verify teacher credentials/testimonials and remove unsupported superlatives. Do not copy unverified marketing assertions into production.

## 4. Additional functional and accessibility issues

| ID / priority | Finding | Change and validation |
|---|---|---|
| F01 / before launch | “Start 12-question drill” opens a whole category (`components/analytics/ai-insight-panel.tsx:124`). Browser check showed question 1 of 154 for Expression of Ideas. | Make focus mode a bounded 12-question session, or change the promise. Match any projected drill outcome to the real session size. |
| F02 / before launch | Passage renderers tokenize stored text, while imported passages can contain sanitized HTML. | Render approved rich text with text-node-aware annotation support. Test emphasis, entities, paired passages, equations, tables, and highlights; avoid displaying literal HTML tags. |
| F03 / next | Flags, highlights, current position, and unsubmitted choices are local memory; choices can disappear when navigating away. | Save session state by user/session; restore it safely after refresh and retain a choice per question. Start with local persistence if necessary, then cross-device persistence. |
| F04 / before launch | Failed overview requests can become an empty question tree; failed question loads can resemble endless loading. Several analytics queries ignore errors and fall back to zero. | Distinguish “no data yet” from “could not load”; preserve previous data, expose retry, and log the failure. Do not tell students their progress disappeared when the request failed. |
| F05 / next | Returning from practice reuses the initial browse overview; profile saves do not refresh the server shell. | Invalidate/refetch relevant summaries and refresh the shell after successful edits. Avoid refetching unrelated data on every keystroke. |
| F06 / before launch | Settings offers `1550+`, while the stored numeric target is rendered as `1550`; no matching option. | Use numeric values with independent labels. Verify persistence for every score choice. |
| F07 / before launch | Settings says email is verified / account protected without deriving verification status. Resend verification ignores send errors. | Display actual auth state, return truthful resend success/failure, and avoid security claims unsupported by the account record. |
| F08 / before launch | Auth labels are visually present but lack explicit input association; async forms have inconsistent exception/loading handling. | Add IDs/`htmlFor`, accessible error associations and announcements, consistent disabled states, and `try/finally` handling. Test with keyboard and a screen reader. |
| F09 / before launch | `ExamDialog` has a dialog role and Escape handling but no focus placement/trap/return. Global practice shortcuts remain active around overlays. | Manage modal focus and suppress question shortcuts while dialogs, menus, editable content, or calculator interactions own input. Test exit confirmation without changing answers behind it. |
| F10 / next | The observed approximately 710 px dashboard view showed duplicate menu controls. Count-up values can begin at zero until revealed. | Consolidate responsive navigation controls, render stable accessible values, and test narrow and wide layouts in both themes. Browser inspection was not a complete responsive audit. |
| F11 / next | `question_image_url` is returned for practice but the question pane does not display that raster image. Current published scan found no raster-image questions. | Support the image with sizing, alt text, loading/error handling before publishing such content; this is a latent gap, not a current failure across all questions. |
| F12 / next | Desmos failure copy exposes API-key implementation details; existing-script/load-failure paths need robust completion handling. | Show useful student feedback and retry/timeout behavior; log diagnostic details for developers. Test blocked third-party scripts. |
| F13 / next | User profile updates can report success without confirming a row was changed; pending edits can be lost on navigation. | Confirm the saved row/result, show field-level errors, and offer an unsaved-change warning where useful. |
| F14 / before launch verification | `proxy.ts` builds refreshed cookies on one response but creates separate redirect responses without copying them. Login redirects also preserve only the pathname, losing practice query parameters. | Preserve refreshed cookies when redirecting; carry the validated intended path and query. Test expired access-token refresh during redirects and a signed-out focus-drill link. This edge case was identified in code, not reproduced with a live expiring session. |

## 5. Analytics and AI correctness

| ID / priority | Finding | Recommended action |
|---|---|---|
| A01 / before broad use | Dashboard's 63-day row query and analytics history query are not paginated. A time window does not bound the number of rows. Dashboard sorts ascending, so truncation can omit the newest data. | Aggregate counts in SQL; explicitly bound recent series with descending selection then reverse for display; paginate history. Supabase defaults to at most 1,000 returned rows unless configured otherwise. The existing student data was below this threshold. [Supabase platform row-limit documentation](https://supabase.com/docs/reference/python/select). |
| A02 / before launch | A dashboard subject comparison uses all-time accuracy against the prior 30-day window, although `last30` was computed. | Compare like-for-like windows and label them. Test historical-only, recent-only, and mixed data. |
| A03 / before launch | “This month” uses 28 days; “this week” uses rolling seven days, while progression uses calendar-week boundaries. Dashboard uses server-local day calculations while other areas use UTC or user timezone. | Pick explicit product definitions and reuse user-timezone date helpers. Test around midnight and month/week boundaries. |
| A04 / before launch if AI enabled | `GET /api/ai/insights` may incur model cost and write a cache. The daily cap is count-then-compute; concurrent calls can bypass it. Count-query failures fall back to zero, and cache insert errors are ignored. | Use POST for fresh computation, an atomic usage reservation and request deduplication, bounded retries, and a hard budget. Read cached results separately. Fail safely on quota/storage errors. |
| A05 / next | AI panel can fetch even when there is too little priority evidence to show the result; summary generation is repeated. | Gate before calling the model, cache by stable summary/version, and show when an insight was generated. Use deterministic recommendations until enough evidence exists. |
| A06 / before launch copy; improve later | Readiness is an internal heuristic over practice evidence, not a validated SAT score predictor. Repeated guesses and uneven question coverage can distort it. | Keep it clearly labeled as a practice indicator; show sample size/coverage and avoid claims of a guaranteed score gain. Calibrate before producing official-scale score predictions. |
| A07 / next | Older-history-only users receive a stale/empty analytics view that hides useful history. | Preserve access to historical totals and explain why recent readiness is unavailable. |
| A08 / free beta decision | Analytics is gated to pro/elite while the upgrade destination has no purchase path. | Offer coherent beta access to basic progress, or label restricted features as unavailable. Do not present an actionable paid upgrade that cannot be completed. |

## 6. Question bank and content quality

The connected data contains **1,581 questions: 1,561 published and 20 archived**, across two subjects, eight categories, and 29 topics. Published totals are **757 Reading and Writing** and **804 Math**.

| Published category | Easy | Medium | Hard | Total |
|---|---:|---:|---:|---:|
| Information and Ideas | 60 | 82 | 113 | 255 |
| Craft and Structure | 63 | 63 | 62 | 188 |
| Expression of Ideas | 40 | 77 | 37 | 154 |
| Standard English Conventions | 45 | 42 | 73 | 160 |
| Algebra | 102 | 110 | **0** | 212 |
| Advanced Math | 57 | 96 | 102 | 255 |
| Problem-Solving and Data Analysis | 80 | 79 | 66 | 225 |
| Geometry and Trigonometry | 44 | 68 | **0** | 112 |

- **C01 / next:** fill the hard Algebra and hard Geometry/Trigonometry gaps. Until then, handle zero-result filters well and avoid claiming complete difficulty coverage.
- **C02 / before launch:** repair the 11 published questions without a topic. Manual authoring currently lacks topic selection, so this can recur.
- **C03 / before enabling detailed AI claims:** 1,552 of 1,561 published questions have no tags. AI weakness analysis relies on wrong-answer tags for subtopics; use existing topic/category identifiers and names in the summary, then add useful tags through a reviewed process. Promotion currently inserts `tags: []`.
- **C04 / before launch:** visually inspect a stratified sample from every category/difficulty and every grid-in, table, and SVG rendering type, including long passages and both themes. The scan found 152 published SVG questions and 79 table questions. Structural validation is not visual verification.
- **C05 / next:** investigate five identical-stem groups as possible duplicates. They are candidates only—different passages/options can make identical stems legitimate. No duplicate nonempty source-reference groups were found.
- **C06 / before launch:** establish a teacher review process for answer correctness, explanations, taxonomy, difficulty, and source provenance. The automated scan found no empty explanations, invalid basic MCQ option shapes, or missing canonical grid-in accepted answers under its checks; those checks do not prove educational correctness or permission to republish content.
- **C07 / next:** add “Report a problem” with question ID and a small admin review queue. This provides a practical correction path after release.

## 7. Admin and database work

| ID / priority | Finding | Change and acceptance |
|---|---|---|
| D01 / before launch | Admin API handlers use `requireAdmin`, which is good. Some server pages make service-role reads and rely on the parent layout's gate. | Put authorization next to privileged reads as well. Keep database-backed role checks and verify student requests cannot obtain privileged page/RSC data. This is a defense-in-depth finding, not a demonstrated page leak. [Next.js guidance on layout authorization](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks). |
| D02 / before launch | Base-table RLS, profile-creation/auth triggers, and a reproducible initial schema are not fully represented in the tracked migration path. `db:migrate` points at a different directory from manual SQL 001–012. | Record the actual migration baseline and execution process; recreate it in a clean staging project. A roadmap stating “RLS enabled” is not deployment evidence. |
| D03 / before launch verification | `DATABASE_URL` did not resolve; `drizzle.config.ts` does not explicitly load `.env.local`. | Verify the provider connection string and how CLI environment variables are loaded. Use appropriate direct/pooler settings for the actual runtime. Do not dump connection strings into logs. |
| D04 / next, before generating schema changes | `questions.source_ref` exists in SQL/types but is missing from the Drizzle question model. `topicId` lacks the foreign-key reference represented in SQL. | Reconcile Drizzle, generated Supabase types, and the actual catalog. Inspect generated migration diffs for unintended column/index drops. |
| D05 / before applying progression migration elsewhere | SQL 012 drops/rebuilds trigger-related state without an explicit enclosing transaction in the file. Safety depends on the execution wrapper. | Use a controlled transactional migration/maintenance procedure and validate backfill totals. Do not rerun production backfills casually. |
| D06 / before launch for content editors | Question authoring API/form does not carry topic and source-reference metadata through the normal manual workflow; category changes can leave stale topic relationships. | Include topic selection and validate subject → category → topic consistency server-side. Preserve imported metadata when editing unrelated fields. |
| D07 / before launch for content editors | Question validation happens before sanitization, so HTML that becomes empty after cleaning can pass original length checks. Accepted grid-in values are mostly checked for presence. | Validate the sanitized result, option uniqueness, answer consistency, and supported grid-in grammar. Return actionable field errors. |
| D08 / before scaling imports | Promotion inserts a question and then links the import item in separate operations; link-update failures are not handled reliably. Existing source-reference uniqueness helps, but is not a full transaction. | Promote and link atomically; make retries/concurrent clicks idempotent. Validate final status and provenance. |
| D09 / before launch for reviewers | Editing a verification-failed item can reset its status after ordinary field validation; structural/figure review concerns need a durable resolution decision. | Preserve unresolved structural flags or require explicit reviewer acknowledgement. Validate the same conditions in the promotion endpoint, not only the UI. |
| D10 / next | Import parsing accepts a sizable HTML upload synchronously; image upload failures can return no image without a strong error signal. The current 257-question fixture itself parsed quickly. | Enforce upload limits before expensive work where possible, surface asset failures, and move genuinely long tasks to bounded background work when measurements justify it. |
| D11 / next | Import edit/reject audit coverage is incomplete; audit logging is best-effort and the helper's “fire-and-forget” comment does not match awaited usage. | Record critical content and entitlement changes consistently. Prefer transactional audit records for sensitive state changes; add a searchable admin viewer later. |
| D12 / before public admin expansion | Last-admin protection counts admins and then updates separately. Concurrent demotions can race. | Enforce the invariant transactionally with a lock or appropriate database function; verify at least one admin remains. |
| D13 / next | Deleting an import removes its source HTML, while generated image objects can remain. | Add safe orphan detection/cleanup with references checked across published questions. Do not delete images simply because an import job is deleted. |
| D14 / paid-launch gate | Subscriptions page is a manual tier overview, includes bounded lists and client-derived totals, and labels manual access as paid. No complete billing implementation exists. | Rename accurately for beta; add real transaction-backed reporting only alongside billing. Account for pagination before calculating global totals. |

## 8. Dependencies: what to keep, move, remove, or patch

There are **15 direct production dependencies and 15 development dependencies**. “No application import” is not the same as “unused”: some packages support scripts or the database CLI.

| Package | Observed use | Recommendation |
|---|---|---|
| `@supabase/ssr` | Cookie-aware browser/server auth clients and callback | Keep |
| `@supabase/supabase-js` | Admin client, Supabase operations and types | Keep |
| `cheerio` | HTML import and markup sanitizers | Keep server-side |
| `drizzle-orm` | Drizzle schema only; app queries use Supabase | Move to development dependencies if schema tooling is build/developer-only; do not delete the schema workflow |
| `lucide-react` | Student UI icons | Keep |
| `next` | Framework, installed 16.2.6 | Patch as B01 |
| `pnpm` | Package manager installed as a production dependency; no app import | Remove from app dependencies; pin the intended tool through `packageManager` and build environment |
| `postgres` | No application source import found | Confirm Drizzle tooling's driver resolution; move to development dependencies if needed there, otherwise remove |
| `posthog-js` | Root provider and page views | Used, not dead. Conditionally load it or remove the integration if beta analytics will not use it |
| `posthog-node` | Only imported by unreachable `lib/posthog/server.ts` | Remove package and helper unless server events are about to be implemented |
| `react` | Components and hooks | Keep |
| `react-dom` | Framework rendering; explicit portal use | Keep |
| `react-icons` | Active admin and practice UI imports | Keep for now. Consolidate icon libraries later; not unused |
| `server-only` | Protects privileged/server modules from client imports | Keep |
| `zod` | AI response validation | Keep; reuse for API runtime schemas |
| `@eslint/eslintrc` | No direct config import; project uses flat ESLint config | Remove direct entry after verifying lint; it may remain transitively |
| `@types/node` | Node TypeScript types | Keep; align with chosen supported Node runtime |
| `@types/react` | React types | Keep |
| `@types/react-dom` | React DOM types | Keep |
| `autoprefixer` | PostCSS configuration | Keep |
| `cross-env` | Seed/storage scripts | Keep |
| `domhandler` | Type imports in sanitizers/parser | Keep as development dependency |
| `dotenv` | Seed runner environment loading | Keep |
| `drizzle-kit` | Schema tooling scripts | Keep if maintaining Drizzle workflow; review transitive advisories |
| `eslint` | Lint script | Keep |
| `eslint-config-next` | Next lint integration | Upgrade together with Next |
| `postcss` | CSS pipeline | Keep; patch affected resolved versions |
| `tailwindcss` | Tailwind/PostCSS configuration | Keep; defer an unrelated major-version migration |
| `tsx` | Seed scripts and execution of existing TS tests | Keep |
| `typescript` | Typecheck/build | Keep |

The full advisory export includes installed versions, affected/patched ranges, and dependency paths. Many findings are below development tooling or the unnecessary `pnpm` runtime package. Resolve them through supported parent upgrades where possible. Removing build-only packages mostly improves install/deployment size and maintenance; it is not the primary remedy for student page rendering.

## 9. Unnecessary code, assets, configuration, and promises

- **R01 — Remove the unused server PostHog helper** together with its package if server event capture is not part of this release. The source reachability scan found no importing application path.
- **R02 — Remove the unused `ProgressArea` export** in `components/analytics/charts.tsx` after a final reference check. Other chart exports are used by mock results; retain them if keeping the internal mock implementation.
- **R03 — Clean proven obsolete CSS.** The old `.pbr-*` block has no matching literal class uses, and most old `.dash2-*` rules are unused except the retained reveal class. Other old analytics/import blocks have partial use. Dynamic class construction, breakpoints, and keyframes mean a literal search is a candidate list, not a safe automatic deletion algorithm.
- **R04 — Remove generated `.superpowers/brainstorm` files from version control** after preserving any useful design decisions. They total about 354 KB and are already ignored for future files; ignore rules do not untrack existing files. This is repository hygiene, not a browser-speed fix.
- **R05 — Simplify the inherited Python-heavy `.gitignore`** to relevant entries when convenient, preserving secret/environment/build exclusions. Low priority.
- **R06 — Remove stale `trigger.config.ts` from the TS include list** if Trigger is no longer used. Review related legacy environment/documentation references. No current Trigger implementation was found.
- **R07 — Decide whether `.stylelintrc.json` is intentional editor tooling.** There is no installed stylelint/script. Remove it if unused, or wire a deliberate check later. `.hintrc` only disables the inline-style hint; it is not a rendering bottleneck.
- **R08 — Review `.npmrc` hoist exceptions** after confirming their original purpose. Do not delete them solely because their packages have no direct source imports; build tools can depend on resolution behavior.
- **R09 — Keep the HTML import fixture** as a useful regression asset. `design/`, docs, and fixtures are not automatically shipped as browser payloads; deleting them does not make page rendering faster.
- **R10 — Keep migration history and useful skills.** Do not delete old SQL because its feature is no longer visible. Development skill folders are tooling, not app dependencies. Consolidating duplicate skill instructions can be separate repository maintenance.
- **R11 — Correct stale roadmap assertions.** Docs describe Stripe, Resend, Upstash, Sentry, certificate generation, background jobs, and operational practices that are not demonstrated by the implementation. Mark each feature “implemented”, “manual”, “planned”, or “retired”. Update root metadata and landing copy accordingly.
- **R12 — Simplify the student promise.** Use clear task names such as Practice, Progress, and Settings. Keep the existing visual identity, but reduce decorative jargon where it makes a basic learning action harder to understand.

## 10. Operational work before and after launch

1. **O01 / before launch:** add a reproducible CI check for lint, typecheck, the existing tests, and production build. Add a `test` script. Prioritize meaningful new tests for B03–B08; a large coverage target is less useful than these failure cases.
2. **O02 / before launch:** add application error boundaries, a usable not-found page, structured server errors/request IDs, and minimal monitored error reporting. Avoid logging tokens, full student answers unnecessarily, or provider secrets.
3. **O03 / before launch:** verify deployment env values and production auth redirects; use a supported pinned Node/package-manager version. Confirm the deployment is running a production build, not the development server.
4. **O04 / before launch:** verify backup availability and perform a staging restore rehearsal; record rollback steps and the previous deploy identifier. The repository's backup claims were not independently verified.
5. **O05 / before public traffic:** add bounded rate limits for expensive/authenticated APIs, especially grading and AI computation. Review request origins for cookie-authenticated mutations and CORS behavior; do not assume every endpoint is protected by the admin layout.
6. **O06 / next:** narrow `next.config.ts` image remote patterns to the actual project/buckets. Review security headers; remove obsolete `X-XSS-Protection` and introduce a tested Content Security Policy, starting with report-only if needed. Account for current inline scripts/styles and Desmos so the policy does not break practice.
7. **O07 / before launch:** add favicon, correct page metadata, social preview, and public-site indexing controls. Keep private app content out of search indexing. A robots file is not access control.
8. **O08 / before launch:** replace the two-line README with exact local setup, environment variable descriptions without values, migration procedure, seed instructions, checks, and deploy/rollback notes. Separate actual operational steps from aspirational architecture.
9. **O09 / before launch:** define support/contact and account-data request handling. Publish truthful privacy and terms information reviewed for the actual service and users. The audit did not conduct legal compliance analysis.

## 11. Features worth adding, in order

**First release / immediate follow-up:** readable explanations; bounded practice sessions with finish summaries; retry/error states; reliable progress; a question-report action; simple onboarding for exam date, target, and starting level. These improve the core experience more than adding another destination page.

**Next two weeks, after release gates:** a durable mistake-review queue, saved questions, resume practice, unattempted-question prioritization, topic-level progress with evidence counts, and a simple deterministic study recommendation. Choose a few reliable actions over an elaborate AI planner. A student should be able to answer: “What should I practice today, why, and what did I learn?”

**Later, after sufficient content and validation:** spaced review, teacher-assigned sets, class/teacher reporting if that matches the business, adaptive practice, and carefully evaluated AI coaching. Add full mocks only after implementing the intended official module structure, timing, persistent test sessions, server-owned submission state, accommodations where offered, and defensible scoring. Verify current official exam requirements at that implementation stage.

**Defer:** certificates, more XP cosmetics, leaderboards, community/chat, large video-course infrastructure, multiple payment providers at once, and precise SAT-score predictions. They add maintenance and expectation without repairing the current learning loop. For paid access later, choose one viable payment flow for the operator's actual region and entity, then implement checkout, signed/idempotent webhooks, cancellation/refunds, entitlement expiry, and reconciliation before advertising subscriptions.

## 12. A realistic two-day sequence

This is a sequence, not a guarantee that one developer can resolve every finding in two days. If a release gate remains open, keep access limited or move the public date. The full backlog is substantially larger than the deadline.

| Window | Work | Exit condition |
|---|---|---|
| Day 1, first block | Patch framework/dependency exposure; restrict mocks; validate redirects and API payloads | Build/checks pass; student mock API access denied; malformed requests handled |
| Day 1, second block | Verify/fix RLS and answer-key separation; fix grid-in parser, navigation race, submission idempotency | Student isolation and grading regression cases pass |
| Day 1, final block | Fix signup/recovery; show explanations and a clear finish/retry path | One complete new-student learning journey works |
| Day 2, first block | Ship truthful landing and consistent auth styling; remove dead-end purchase promises | New visitor can enter, understand scope, and get help |
| Day 2, second block | Remove landing DB wait; aggregate dashboard work; reduce fonts and obvious shared asset waste | Before/after production measurements show improvement |
| Day 2, final block | Staging browser checks, content samples, timezone/error cases, production env/backup/rollback verification | Release checklist below passes; launch small and observe |

If time runs short, defer paid billing, AI generation, deep admin visual changes, full CSS restructuring, and new analytics sophistication. Retain only features that have been verified end to end. Do not defer answer correctness, account access, private-data protection, or truthful availability.

### Release acceptance checklist

- [x] Applicable framework vulnerabilities patched; remaining advisories triaged. See the Step 01 record for outstanding dependency cleanup.
- [x] Students see mock “In development”; direct mock endpoints are restricted. See the Step 02 record.
- [ ] Two student accounts cannot access each other's data, private answer keys, admin data, or privileged fields.
- [ ] Signup confirmation and password recovery work on the final domain, including invalid/expired links.
- [ ] Grading rejects malformed input; fast navigation and repeat submissions cannot corrupt results.
- [ ] MCQ and grid-in questions display correctly, show explanations, and reach a completion state.
- [ ] Network errors have retry states; saved attempts are not duplicated by retries.
- [ ] Landing and auth pages are complete; public claims and links match the beta.
- [ ] No purchase CTA leads to a nonfunctional billing path.
- [ ] Category/difficulty empty states are truthful; representative question content has been teacher-reviewed.
- [ ] Dashboard totals, comparison windows, and timezone boundaries are consistent.
- [ ] Production performance measured after changes; core navigation feels responsive on a target phone and laptop.
- [ ] Keyboard navigation, modal focus, both themes, and narrow layouts checked.
- [ ] Build, lint, types, existing tests, and focused regression checks pass in CI.
- [ ] Deployment/auth configuration, monitoring, backup restoration, rollback, and support ownership verified.

The strongest launch scope is a dependable question-practice platform with understandable progress. The current repository already contains enough visual design and content to support that scope once the release gates are closed.
