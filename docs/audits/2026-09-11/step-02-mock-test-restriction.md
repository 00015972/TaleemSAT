# Step 02 — mock-test restriction

Completed locally on 11 September 2026. This implements B02 of the [launch audit](../../launch-audit-2026-09-11.md). It does not deploy the application or complete the other launch gates.

## Change

- Replaced the student mock setup and start controls at `/mock` with “Mock tests are in development” inside the existing authenticated app shell.
- Added a “Practice questions” link to `/question-bank`.
- Added an “In development” badge to the Mock Test navigation item, including an accessible label and collapsed-sidebar title.
- Changed both mock API handlers to return `401 AUTH_REQUIRED` for signed-out requests and `403 MOCK_IN_DEVELOPMENT` for every signed-in account.
- Removed all question loading, answer-key reads, grading, progression work, and attempt writes from the active mock handlers. The dormant runner remains in the repository for later development but has no page entry point.
- Did not add an admin preview. URL parameters and client metadata cannot bypass the restriction.

## Validation

| Check | Result |
|---|---|
| Focused mock API regression test | 21 passed, 0 failed: start and submit; signed-out, free, pro, elite, and forged admin metadata; valid, malformed, and null submit bodies |
| Database and request-order assertions | Passed: denied calls never parse the submit body or invoke user/admin database clients |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Existing readiness, date, and rich-text tests | 15 passed, 0 failed |
| Production build | Passed with Next.js 16.3.4 using webpack; route inventory preserved |
| Local production browser check | Passed with an authenticated student: development notice, navigation badge, and Practice questions link were visible; no start controls were present |
| Anonymous production HTTP check | Both start and submit returned `401 AUTH_REQUIRED`, including attempted URL-parameter bypasses |

The default Turbopack build could not run in this execution environment because its CSS worker was denied permission to bind a local port. The webpack production build completed successfully, and the built application was used for the browser and HTTP checks.

The focused test uses mocked authenticated identities and fail-fast database clients. It verifies all current student tiers and proves the handlers return before their request or database work. It does not create or change live attempts or student records.

## Result

B02 is complete locally. Free, pro, and elite accounts receive the same server-enforced restriction. Signed-out access remains protected, and no client flag, request body, query string, or user metadata enables the unavailable feature.

The next release gate in the audit is B03: close or conclusively verify the answer-key boundary.
