# 12 — Testing Strategy

> How we verify the platform works. Unit, integration, e2e, manual QA, accessibility, performance.
> Cross-refs: [13-deployment-ops.md](13-deployment-ops.md) · [05-security.md](05-security.md)

---

## Testing philosophy

Three principles:

1. **Test what's risky, skip what's obvious.** Don't test that React renders a div. Test the auth gate, the points calculation, the RLS policy.
2. **Tests should fail loudly when they catch a real bug.** A flaky test is worse than no test.
3. **Type checking is not testing.** TypeScript catches some things; tests catch behavior.

We follow the **test pyramid:**
```
            ┌────────┐
            │  E2E   │  ← few, slow, real user journeys
            └────────┘
          ┌────────────┐
          │ Integration │  ← API routes, DB interactions
          └────────────┘
        ┌────────────────┐
        │      Unit       │  ← lots, fast, isolated logic
        └────────────────┘
```

---

## Tools

| Layer | Tool | Why |
|---|---|---|
| Unit | **Vitest** | Fast, ESM-native, great DX |
| Component | **Testing Library** + Vitest | Tests components like users use them |
| Integration | **Vitest** + test database | Same runner, real DB |
| E2E | **Playwright** | Cross-browser, screenshot, video on failure |
| Mock | **MSW** | Mock HTTP for client tests |
| Accessibility | **axe-core** via Playwright | Auto-detect a11y issues |
| Performance | **Lighthouse CI** + Vercel Speed Insights | Budgets enforced on every deploy |
| Load | **k6** (when needed) | Simulate load on key endpoints |

---

## Unit tests

### What to unit-test
- Pure functions (calculations, formatters)
- Business logic (e.g., `shouldAwardCertificate(currentPoints, newPoints)`)
- Validators (Zod schemas with edge cases)
- Utility functions
- Component rendering logic that's non-trivial

### What NOT to unit-test
- Framework code (Next.js routing, React hooks)
- Style classes
- Pass-through wrappers

### Example
```ts
// app/lib/points/calculateMilestone.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMilestone } from './calculateMilestone';

describe('calculateMilestone', () => {
  it('returns next milestone for 18 points', () => {
    expect(calculateMilestone(18)).toEqual({ next: 25, reached: false });
  });
  
  it('detects 25-point milestone', () => {
    expect(calculateMilestone(25)).toEqual({ next: 50, reached: true });
  });
  
  it('handles 0 points', () => {
    expect(calculateMilestone(0)).toEqual({ next: 25, reached: false });
  });
});
```

### Run
- `pnpm test` — runs all unit tests
- `pnpm test --watch` — dev mode
- Coverage target: not enforced. We test what matters; coverage % is a vanity metric.

---

## Component tests

### Approach
- Test the component's **behavior** from a user's perspective.
- Don't test implementation details (class names, internal state).
- Use Testing Library: `getByRole`, `getByLabelText`, NOT `getByTestId` (unless absolutely needed).

### Example
```ts
// app/components/QuestionCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from './QuestionCard';

describe('QuestionCard', () => {
  const question = {
    id: '1',
    question_text: 'What is 2+2?',
    options: { A: '3', B: '4', C: '5', D: '6' },
  };

  it('disables submit until an option is selected', async () => {
    render(<QuestionCard question={question} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    
    await userEvent.click(screen.getByLabelText('B 4'));
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('calls onSubmit with selected answer', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={question} onSubmit={onSubmit} />);
    
    await userEvent.click(screen.getByLabelText('B 4'));
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(onSubmit).toHaveBeenCalledWith('B');
  });
});
```

---

## Integration tests (API + DB)

### Approach
- Spin up a real Postgres instance (Docker or test container).
- Run migrations.
- Test API routes end-to-end with real Supabase + DB.

### What to integration-test
- Every API route's happy path
- Auth gates (unauthenticated → 401)
- Tier gates (free user → 402)
- RLS policies (user A can't read user B's data)
- Stripe webhook handlers (with mocked Stripe events)
- Database constraints (unique violations, etc.)

### Example
```ts
// app/api/attempts/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testClient, createTestUser, resetDb } from '@/test/helpers';

describe('POST /api/attempts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await testClient.post('/api/attempts', { 
      question_id: 'x', selected_answer: 'A' 
    });
    expect(res.status).toBe(401);
  });

  it('records a correct answer and returns explanation', async () => {
    const { user, session } = await createTestUser({ tier: 'pro' });
    const question = await seedQuestion({ correct_answer: 'B' });
    
    const res = await testClient
      .post('/api/attempts')
      .auth(session)
      .send({ question_id: question.id, selected_answer: 'B', time_taken_ms: 5000 });
    
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(true);
    expect(res.body.data.explanation).toBeTruthy();
  });
  
  it('enforces daily quota for free tier', async () => {
    const { user, session } = await createTestUser({ tier: 'free' });
    await seedAttempts(user.id, 5);
    
    const res = await testClient
      .post('/api/attempts')
      .auth(session)
      .send({ question_id: 'x', selected_answer: 'A' });
    
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('TIER_INSUFFICIENT');
  });
});
```

### RLS-specific tests

```sql
-- test/sql/rls_attempts.sql
-- Run as user A
SET ROLE auth_user_a;
SELECT count(*) FROM attempts; -- should only return A's rows

-- Try to read B's
SELECT * FROM attempts WHERE user_id = 'user-b-uuid'; -- should return 0 rows, not error
```

Run via a small script that runs each SQL test and asserts expected results.

---

## End-to-end tests

### Approach
- Playwright drives a real browser against a real deployed environment.
- Test the critical user journeys, not every page.
- Run on every PR + on schedule against staging.

### Critical journeys to E2E

1. **Sign-up + first practice** — student creates account, verifies email (mocked), answers a question.
2. **QOD ritual** — student answers QOD, earns point, sees points update.
3. **Upgrade flow** — student clicks upgrade, completes Stripe Checkout (test card), lands as Pro.
4. **Certificate earning** — student earns 25 points, downloads PDF.
5. **Admin imports CSV** — admin uploads CSV, sees questions in list.
6. **Cancel subscription** — Pro user cancels via portal, retains access until period end.

### Example
```ts
// e2e/signup-flow.spec.ts
import { test, expect } from '@playwright/test';

test('new user can sign up and answer first question', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Get Started');
  
  await page.fill('input[name=email]', `test-${Date.now()}@example.com`);
  await page.fill('input[name=password]', 'TestPass123!');
  await page.fill('input[name=full_name]', 'Test User');
  await page.click('button[type=submit]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('text=Welcome')).toBeVisible();
  
  await page.click('text=Answer today\'s question');
  await expect(page).toHaveURL('/qod');
  
  await page.click('input[value=A]');
  await page.click('text=Submit');
  
  await expect(page.locator('text=Correct') /* or "Not quite" */).toBeVisible();
});
```

### Test data
- Each E2E test creates its own user (unique email with timestamp).
- Cleanup runs nightly to delete test users.

---

## Manual QA

Some things are hard or expensive to automate. Manual QA checklist before every major release:

### Pre-release smoke test (30 min)
- [ ] Sign up with a fresh email
- [ ] Verify welcome email arrives
- [ ] Log out, log back in
- [ ] Forgot-password flow (verify email arrives)
- [ ] Answer 3 practice questions in different categories
- [ ] Wrong answer shows explanation
- [ ] Correct answer feels good
- [ ] Answer today's QOD
- [ ] Streak updates on dashboard
- [ ] Analytics page renders accurate stats
- [ ] Upgrade to Pro with Stripe test card 4242 4242 4242 4242
- [ ] AI insight loads on Pro
- [ ] Manage subscription opens Stripe portal
- [ ] Cancel subscription — Pro access retained until period end
- [ ] Light/dark theme toggle works on every page
- [ ] Mobile (375px width) — every page is usable

### Admin manual QA
- [ ] Log in as admin
- [ ] Add a question via form
- [ ] Edit the question
- [ ] Preview matches student view
- [ ] Archive question
- [ ] Import CSV (sample 5-row file)
- [ ] Errors in CSV are reported correctly
- [ ] Schedule a QOD
- [ ] Unschedule a QOD
- [ ] View a user's profile
- [ ] Adjust a user's points
- [ ] Audit log shows the change

---

## Accessibility testing

### Automated
- axe-core runs on every E2E test page load
- Lighthouse a11y score must be ≥ 95 in CI

### Manual (every major release)
- [ ] Tab through every page — focus always visible, logical order
- [ ] Submit forms with keyboard only
- [ ] Use NVDA or VoiceOver to navigate a full session
- [ ] Confirm screen reader announces correct/wrong on answer submit
- [ ] Verify color contrast on light + dark theme using DevTools picker
- [ ] Test with `prefers-reduced-motion` enabled

### a11y target: WCAG 2.2 AA
- Color contrast 4.5:1 (text), 3:1 (UI components)
- All interactive elements 44×44px tap target on mobile
- All images have alt text
- All inputs have labels
- All buttons have accessible names

---

## Performance testing

### Budgets enforced via Lighthouse CI

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 3500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

Runs on every PR via GitHub Action against the Vercel preview URL.

### Real-user monitoring
- Vercel Speed Insights — collects web vitals from real users
- PostHog session replays — see what slow users experience

### Load testing (only when needed)
- k6 against staging endpoint, simulate 100 RPS
- Run before major launches or feature changes that hit DB hard

---

## Security testing

### Static
- `pnpm audit` — npm vulnerability check in CI
- Snyk or similar SCA tool — weekly
- ESLint security plugin

### Dynamic
- Manual test of common attacks: SQL injection on inputs (should be impossible via Drizzle), XSS in question text rendering, IDOR (try to read other user's data via direct URL)
- Penetration test before public launch (third party, ~$2-5k)

### RLS verification (automated, every migration)
- Test suite that runs SQL as different roles and asserts read/write permissions.

---

## CI pipeline

GitHub Actions, runs on every PR:

```yaml
jobs:
  lint:
    # eslint, prettier, type-check (tsc --noEmit)
    
  unit:
    # vitest run
    
  integration:
    # spin up postgres in service container
    # run migrations
    # vitest run integration/
    
  e2e:
    needs: [unit, integration]
    # build app, run playwright against preview
    
  lighthouse:
    needs: [e2e]
    # run lighthouse against preview
    
  security:
    # pnpm audit, optional snyk
```

Required to pass: lint, unit, integration, security.
Soft (warns but doesn't block): e2e (flaky tests), lighthouse on first attempt.

---

## Bug triage

When a bug is reported (by user, by Sentry, by us):

| Severity | Definition | Response |
|---|---|---|
| **P0** | Site down, data loss, payment broken, security breach | Fix immediately, postmortem |
| **P1** | Major feature broken (can't sign up, can't take QOD) | Fix within 24h |
| **P2** | Minor feature broken, workaround exists | Fix within 1 week |
| **P3** | Cosmetic, edge case | Backlog, fix when convenient |

Bugs logged as GitHub Issues with `bug` label + severity label.

---

## Regression policy

When fixing a bug:
- [ ] Add a test that fails on the bug
- [ ] Fix the bug
- [ ] Test now passes
- [ ] Mention test name in PR description

This guarantees the bug stays fixed.

---

## What we don't test (yet)

- ❌ Full visual regression (Chromatic, Percy) — overkill for now; we'll know if a page looks broken
- ❌ Mutation testing — overkill
- ❌ Fuzzing — overkill for our scale
- ❌ Cross-browser beyond Chrome + Safari + Firefox — Playwright covers these

---

## Test data management

### Seed data
- `seeds/` directory has SQL files for dev/test environments
- Production never runs seeds
- Test environments get reset between runs

### Test users
- Convention: emails are `test-<purpose>-<timestamp>@example.com`
- Cleaned up by a nightly job

### Test cards (Stripe)
- `4242 4242 4242 4242` — success
- `4000 0000 0000 9995` — declined
- `4000 0025 0000 3155` — requires 3DS
- More at [stripe.com/docs/testing](https://stripe.com/docs/testing)

---

**See next:** [13-deployment-ops.md](13-deployment-ops.md) for how we deploy and monitor in production.
