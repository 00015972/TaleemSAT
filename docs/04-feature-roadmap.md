# 04 — Feature Roadmap

> Phased build plan. What we build, in what order, why, and what "done" means for each phase.
> Cross-refs: [01-architecture.md](01-architecture.md) · [07-ux-flows.md](07-ux-flows.md)

---

## Principles

1. **Ship a usable product after every phase.** Each phase ends in a deployable state.
2. **Earliest value first.** Things that build the email list (signup) come before things that don't (mock tests).
3. **Hard things early.** Auth, payments, content pipeline — these are foundational. Build them before they're urgent.
4. **No backwards-compat debt.** We're pre-launch — break and rebuild freely until we have real users.
5. **Manual before automated.** Many ops can be manual at first (certificate review). Automate only when manual hurts.

---

## Phase 0 — Foundation (3–5 days)

**Goal:** A blank Next.js app deployed to Vercel, connected to Supabase, with an empty admin user.

| Task | Notes |
|---|---|
| Scaffold Next.js 14 (App Router) with TypeScript | `pnpm create next-app` |
| Configure Tailwind + shadcn/ui | Match design tokens from [06-design-system.md](06-design-system.md) |
| Set up Supabase project (dev) | Save `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `ANON_KEY` |
| Install Drizzle, write initial schema | Tables from [02-database-schema.md](02-database-schema.md) |
| Apply initial migration to Supabase | All tables + RLS policies in place |
| Seed subjects + categories | Static data |
| Deploy to Vercel (preview) | Connect GitHub repo |
| Set up Sentry + PostHog | Empty integrations, ready for events |

**Done when:** I can visit the deployed URL and see a Tailwind-styled blank page. Supabase has the full schema. Sentry receives test events.

---

## Phase 1 — Auth & onboarding (3–5 days)

**Goal:** Students can sign up, log in, and land on a (mostly empty) dashboard. We capture emails.

| Task | Notes |
|---|---|
| Sign-up page with form (Zod + RHF) | Email, password, full name, target score, exam date, marketing opt-in |
| Login page | Email + password via Supabase Auth |
| Forgot password flow | Supabase built-in |
| Auth middleware | Redirect unauth → /login, auth → /dashboard |
| Auto-create `users` row on signup | DB trigger |
| Welcome email on signup | Resend |
| Dashboard skeleton | Header, nav, empty widgets, "Welcome back" |
| Settings page | Read-only profile + log out |

**Phase 1 done when:** A new student can sign up, see a welcome email, and reach the dashboard. Their row exists in `users`. We're already collecting emails.

**Decisions deferred:** Google OAuth (post-launch).

---

## Phase 2 — Practice question engine (5–7 days)

**Goal:** Students can answer questions in any category. Wrong answers show explanations. Quota enforced for free tier.

| Task | Notes |
|---|---|
| Category selector page (`/practice`) | 8 cards, accuracy badge per category |
| Practice page (`/practice/:subject/:category`) | Question card, options, submit, explanation reveal |
| `GET /api/questions/random` | Excludes recently-seen questions |
| `POST /api/attempts` | Submit + record |
| Free-tier daily quota | 5 questions/day/category — server-enforced |
| "Out of questions" empty state | When user has exhausted unseen questions |
| Exit confirmation | "Are you sure?" if mid-question |

**Done when:** A student can practice for 30 minutes without bugs. Accuracy stats update on the dashboard.

---

## Phase 4 — Admin panel + content pipeline (5–7 days)

**Goal:** Admins can manage the entire question bank without touching SQL. The full 200 questions are loaded.

| Task | Notes |
|---|---|
| Admin route group + role gate | `(admin)/` layout, middleware enforces |
| Admin question list | Paginated table, filter by subject/category/status, search |
| Add/edit question form | All fields, with a "Preview" button that renders the question as a student would see it |
| HTML import endpoint | Parses a hand-converted question-bank HTML file, stages rows for review |
| HTML import UI | Drag-drop, upload, hand off to the review queue |
| Bulk load the 200 questions | Real content |
| Admin dashboard | Top-line metrics from `/api/admin/stats` |

**Done when:** Tutor can log in to `/admin` and run the whole content side without me. 200 questions are live.

See [11-content-pipeline.md](11-content-pipeline.md) for the HTML import spec.

---

## Phase 5 — Analytics + AI insights (5–7 days)

**Goal:** Pro/Elite users see real personalized analysis. Free users see basic stats.

| Task | Notes |
|---|---|
| Analytics page (free tier view) | Overall accuracy, by-subject, by-category bars |
| Analytics page (Pro+ view) | + AI insights panel, weakness drill-down |
| `GET /api/analytics/overview` | Aggregated server-side queries |
| `GET /api/ai/insights` with caching | Claude API; cache 24h in `ai_insights` table |
| Empty states | "Answer 10 questions to unlock insights" |
| Trend chart (Elite) | Accuracy over time, week-by-week |

**Done when:** A user who's answered 20 questions sees specific, useful AI feedback on the analytics page. Cost per user is logged.

See [09-ai-features.md](09-ai-features.md) for prompt design.

---

## Phase 6 — Certificates (3–4 days)

**Goal:** When a user hits 25 / 50 / 75 / 100 / 150 / 200 points, they get a downloadable PDF certificate.

| Task | Notes |
|---|---|
| Award certificate row on milestone | Server-side check |
| PDF generation (`@react-pdf/renderer`) | Server-side; styled in editorial gold/green |
| Certificate page (`/certificates`) | Earned + locked tiers |
| `GET /api/certificates/:id/pdf` | Stream PDF, gate behind paid tier |
| Email on certificate earned | "You earned a 25-point certificate!" |
| Free-tier paywall on download | Free users see "Upgrade to download" |

**Done when:** I can hit the 25-point milestone as a paid user and download a PDF with my name on it.

---

## Phase 7 — Payments + tiers (5–7 days)

**Goal:** Users can upgrade to Pro or Elite via Stripe.

| Task | Notes |
|---|---|
| Stripe products + prices configured | Pro $12/mo, Elite $25/mo (USD, monthly only at launch) |
| `POST /api/stripe/checkout` | Creates session |
| `POST /api/stripe/portal` | Manage billing |
| Stripe webhook handler | All subscription lifecycle events |
| Tier-gating across the app | `useTier()` hook checks DB |
| Pricing page | Three cards, current tier highlighted |
| Settings → Subscription tab | Status, next billing date, "Manage" → portal |
| Email on subscription started | Receipt + welcome to Pro/Elite |
| Email on payment failed | Grace period: 3 days then downgrade |

**Done when:** I can pay $12 with a test card, become Pro, lose Pro after canceling at period end.

See [10-monetization-payments.md](10-monetization-payments.md).

---

## Phase 8 — Marketing pages + polish (3–4 days)

**Goal:** Production-quality public surface. Replace the static landing mockup with a real Next.js page.

| Task | Notes |
|---|---|
| Convert `design/landing.html` to a Next.js page | Reuse components |
| About page | Full tutor bio |
| Pricing page (public version) | Same component as authenticated |
| FAQ section | 5–10 common questions |
| Email capture for non-signup leads | `/api/lead` |
| SEO meta + OG tags | Per page |
| Sitemap.xml + robots.txt | |
| Privacy + Terms pages | Stub for now, full text before launch |

**Done when:** A potential student can land on the homepage, learn about the tutor, see pricing, and sign up — without any rough edges.

---

## Phase 9 — Mock SATs (post-launch, Elite-only)

**Goal:** Full-length, timed mock SATs for Elite subscribers.

| Task | Notes |
|---|---|
| Mock test data model | New table or `attempts.context = 'mock'` grouping |
| Timer UI | 32 min English, 35 min Math, breaks |
| Section flow | Module 1 → Module 2 (adaptive in future) |
| Scoring | Approximate 200–800 per section using a calibration table |
| Mock results page | Full breakdown, retake option |
| 4–6 full mock tests at launch | Reuse the format from the Test 2 HTML we already have |

**Done when:** An Elite user can take a full mock and see a 1200/1600 score.

---

## Phase 10 — Polish, retention, growth (ongoing)

These ship in any order based on data:

- Referral program ("Invite a friend, both get 30 days of Pro")
- Multi-language UI (Uzbek, Russian)
- Mobile PWA polish (install prompt, offline practice)
- Leaderboards (opt-in)
- Custom study sets ("Make a set of 20 questions tagged 'quadratics'")
- Spaced repetition for missed questions

---

## Out of scope (explicitly)

For sanity, listing what we're **not** doing:

- ❌ Live tutoring inside the app (delivered via Telegram course externally)
- ❌ Question forums / discussion
- ❌ User-generated content
- ❌ AI-generated questions (we author all questions manually for quality)
- ❌ Image-based questions in v1 (pure text first; geometry diagrams later as SVG)
- ❌ Annual billing at launch (only monthly; revisit after first 100 subscribers)
- ❌ Refunds beyond the first 7 days
- ❌ Affiliate program (Phase 10 at earliest)

---

## Dependencies between phases

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 5 ──► Phase 6
                  │              │
                  │              └─► Phase 4 (admin) ─┐
                  │                                    │
                  └────────────────► Phase 7 ──────────┴──► Phase 8 ──► Launch
                                                                          │
                                                                          ▼
                                                                       Phase 9, 10
```

- Phase 5 (AI) needs real attempts data, so don't start it until Phase 2 is live with a few users.
- Phase 7 (payments) can technically happen earlier but there's nothing worth paying for until Phase 5–6 ship.

---

## Time estimates

These assume one focused developer working 6 hours/day. Multiply by 1.5x for realistic buffer.

| Phase | Estimate | Cumulative |
|---|---|---|
| 0. Foundation | 4 days | 4 |
| 1. Auth | 4 days | 8 |
| 2. Practice | 6 days | 14 |
| 4. Admin | 6 days | 20 |
| 5. AI insights | 6 days | 26 |
| 6. Certificates | 3 days | 29 |
| 7. Payments | 6 days | 35 |
| 8. Marketing pages | 3 days | 38 |
| **Launchable MVP** | **~38 days** | **~5.5 weeks** |
| 9. Mock SATs | 8 days | 46 |
| 10. Growth (ongoing) | — | — |

---

## What "launch" means

Launch = Phase 8 complete + private beta with ~20 students. Public marketing comes after a 2-week beta with iteration.

**Pre-launch checklist:**
- [ ] All Phase 0–8 features pass smoke test
- [ ] Privacy policy + Terms in place
- [ ] Stripe in live mode
- [ ] Real Resend domain verified (no test email sender)
- [ ] 200 questions live
- [ ] Sentry receiving errors
- [ ] PostHog tracking key events
- [ ] Manual QA pass complete (see [12-testing-strategy.md](12-testing-strategy.md))
- [ ] Performance budgets met

---

**See next:** [05-security.md](05-security.md) — what we need to lock down before any real user touches the system.
