# 01 — Architecture

> System architecture, tech stack rationale, folder layout, and how the pieces connect.
> Cross-refs: [02-database-schema.md](02-database-schema.md) · [05-security.md](05-security.md) · [13-deployment-ops.md](13-deployment-ops.md)

---

## High-level system diagram

```
                    ┌──────────────────────────────────────┐
                    │             Student (browser)         │
                    └──────────────────┬───────────────────┘
                                       │  HTTPS
                                       ▼
              ┌──────────────────────────────────────────────┐
              │       Vercel — Next.js 14 (App Router)        │
              │  ┌────────────────────────────────────────┐  │
              │  │  Server Components / RSC               │  │
              │  │  API Route Handlers (/api/*)           │  │
              │  │  Edge middleware (auth gate)           │  │
              │  └────────────────────────────────────────┘  │
              └─────┬───────────┬───────────┬───────────┬────┘
                    │           │           │           │
              ┌─────▼──┐  ┌─────▼────┐ ┌────▼────┐ ┌────▼─────┐ ┌────▼────┐
              │Supabase│  │ Claude   │ │  Payme  │ │ Resend   │ │ Stripe  │
              │ (PG +  │  │   API    │ │  (UZ)   │ │ (Email)  │ │ (intl)  │
              │ Auth + │  │  Haiku   │ │         │ │          │ │         │
              │Storage)│  │          │ │         │ │          │ │         │
              └────────┘  └──────────┘ └─────────┘ └──────────┘ └─────────┘
```

**One sentence:** Next.js on Vercel does the rendering and orchestration; Supabase is the database + auth + file store; Claude/Stripe/Resend are specialized services we call from server code.

---

## Tech stack — choices and reasoning

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 15 (App Router)** | Server components keep bundle small; one repo for front + back; great Vercel integration; Turbopack bundler on by default |
| Styling | **Tailwind CSS** + **shadcn/ui** primitives | Tailwind speeds up the design-system work; shadcn gives us accessible base components we can restyle |
| Hosting | **Vercel** | First-class Next.js support, edge functions, generous free tier |
| Database + Auth | **Supabase** | Postgres (real DB), built-in auth with email/Google, Row-Level Security, Storage for certificate PDFs |
| ORM | **Drizzle** (or Supabase client direct) | Drizzle for typed schema + migrations; Supabase client for RLS-aware reads |
| AI | **Anthropic Claude API** (`claude-haiku-4-5-20251001`) | Sufficient reasoning for SAT analysis at a fraction of Sonnet's cost; prompt caching reduces cost further |
| Payments | **Payme** (Uzbek users) + **Stripe Checkout** (international) | Payme is the dominant local payment method in Uzbekistan; Stripe handles international cards + VAT |
| Email | **Resend** | Simple API, good deliverability, generous free tier |
| Analytics | **PostHog** (self-host or cloud) | Product analytics + session replay + feature flags in one |
| Error tracking | **Sentry** | Source-mapped stack traces, performance traces |
| Forms / validation | **Zod** + **React Hook Form** | Schema once, validate on client + server |
| PDF generation | **@react-pdf/renderer** (server-side) | Generate certificates as PDFs, store in Supabase Storage |

### Why **not**
- **Self-hosted Postgres** — too much ops for a 1-person team early on.
- **Firebase** — auth is good but the data model (Firestore) is awkward for relational data like ours.
- **MongoDB** — same reason; we have strong relations (users → answers → questions → categories).
- **Custom auth** — never roll your own auth.
- **OpenAI as default** — Claude is preferred; Haiku is cheap enough for our workload.
- **PWA / mobile app** — web-only at launch; revisit when there is proven demand.
- **Multi-language** — English-only; Uzbek/Russian localisation deferred post-launch.

---

## Frontend architecture (Next.js App Router)

### Folder layout

```
app/
├── (public)/               ← unauthenticated routes, shared layout
│   ├── layout.tsx
│   ├── page.tsx            ← landing
│   ├── about/page.tsx
│   ├── pricing/page.tsx
│   ├── login/page.tsx
│   └── signup/page.tsx
│
├── (app)/                  ← authenticated student routes, shared dashboard layout
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── practice/
│   │   ├── page.tsx        ← category selector
│   │   └── [subject]/[category]/page.tsx
│   ├── qod/page.tsx
│   ├── analytics/page.tsx
│   ├── certificates/page.tsx
│   └── settings/page.tsx
│
├── (admin)/                ← admin-only routes, role-gated in middleware
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── questions/page.tsx
│   ├── qod/page.tsx
│   └── users/page.tsx
│
├── api/
│   ├── questions/route.ts
│   ├── attempts/route.ts
│   ├── qod/route.ts
│   ├── certificates/[id]/route.ts   ← PDF download
│   ├── stripe/
│   │   ├── checkout/route.ts
│   │   └── webhook/route.ts
│   └── ai/
│       └── insights/route.ts
│
└── middleware.ts           ← session + role check, redirect to /login or /
```

### Server vs client components — default rules

- **Default to server components.** Data fetching, rendering, layout.
- **Use `'use client'` only when needed:** interactive state, event handlers (onClick), browser APIs (localStorage, Intersection Observer), real-time subscriptions.
- Keep client components small. Pass data in from server components as props.

### Data fetching pattern

- **Server components fetch directly** from Supabase using the server client (cookies-aware, respects RLS).
- **Client components** call `/api/*` routes for mutations or use SWR/TanStack Query for revalidation.
- **No client-side direct Supabase access** for writes — always go through an API route so we can validate and rate-limit.

---

## Backend architecture

We don't have a "backend" in the traditional sense — Next.js API routes + Supabase are our backend.

### API route conventions

- **Naming:** `/api/<resource>/<action>` — e.g., `/api/attempts/submit`, `/api/qod/answer`.
- **Auth:** Every route checks the Supabase session via a shared `getSession()` helper. Routes that require admin role check `user.role === 'admin'`.
- **Validation:** Every route validates input with Zod. Return `400` with a friendly error on failure.
- **Response shape:** `{ ok: true, data: {...} }` or `{ ok: false, error: { code, message } }`.
- **Rate limiting:** Heavy or abuse-prone endpoints (e.g., AI calls, signup) use Upstash rate limiter middleware.

### When to use which

| Need | Tool |
|---|---|
| Read user's own data | Server component → Supabase client (RLS handles auth) |
| Read public data (e.g., a question) | Server component → Supabase client |
| Mutate user data | API route → validate → write |
| Call third-party service (Claude, Stripe) | API route — never client-side (API keys must stay secret) |
| Webhook from Stripe / etc. | API route, verify signature first |

---

## Data flow examples

### Example 1: Student answers a practice question

```
1. Student clicks an option on /practice/english/craft-and-structure
2. Client component sends POST /api/attempts
   { question_id, selected_answer, time_taken_ms }
3. Server route:
   - Validates session
   - Validates body with Zod
   - Looks up question's correct_answer
   - Inserts row into attempts table
   - Returns { correct: true|false, explanation, points_earned }
4. Client reveals explanation + animates points if QOD
```

### Example 2: AI weakness insight

```
1. /analytics page renders (server component)
2. Server fetches user's last 50 attempts grouped by category
3. If cached insight is < 24h old → return cached
4. Else, call Claude API with structured prompt + attempt history
5. Claude returns JSON with detected weakness + recommendation
6. Cache result in ai_insights table with user_id + computed_at
7. Render to UI
```

### Example 3: Stripe subscription created

```
1. User clicks "Start Pro" → /api/stripe/checkout creates a Checkout session, returns URL
2. User pays on Stripe
3. Stripe sends webhook to /api/stripe/webhook
4. Verify signature, parse event
5. On checkout.session.completed: update users.tier = 'pro', set subscription_id
6. Resend email: "Welcome to Pro"
```

---

## Environments

| Env | URL | Branch | Database | Stripe |
|---|---|---|---|---|
| Local | localhost:3000 | any | Supabase dev project | Stripe test mode |
| Preview | `*.vercel.app` per PR | PR branches | Supabase dev project | Stripe test mode |
| Staging | staging.taleemsat.com | `staging` | Supabase staging project | Stripe test mode |
| Production | taleemsat.com | `main` | Supabase prod project | Stripe live mode |

All env vars live in Vercel project settings + `.env.local` for development. See [13-deployment-ops.md](13-deployment-ops.md) for the full list.

---

## Third-party services — secrets & vendor table

| Service | What we store there | Secrets we hold | Disaster plan |
|---|---|---|---|
| Supabase | User accounts, questions, attempts, certificates | `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `ANON_KEY` | Daily PITR backups; export via pg_dump weekly |
| Stripe | Customer + subscription records | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe is canonical for billing; we sync subscription state on every webhook |
| Anthropic | (No data stored long-term; we cache responses in our DB) | `ANTHROPIC_API_KEY` | Fallback: degrade AI features gracefully if Claude is down |
| Resend | Email send history (auto) | `RESEND_API_KEY` | Fall back to SMTP via Postmark or skip email if down |
| Vercel | Deployments + analytics | (project access tokens) | Code lives in GitHub; can redeploy anywhere |

Never commit secrets. `.env.local` is `.gitignore`'d. See [05-security.md](05-security.md) for rotation policy.

---

## Performance budget

| Metric | Target | Hard ceiling |
|---|---|---|
| Largest Contentful Paint (LCP) | < 1.8s | < 2.5s |
| First Input Delay (FID) / INP | < 100ms | < 200ms |
| Cumulative Layout Shift (CLS) | < 0.05 | < 0.1 |
| Time to Interactive (TTI) | < 3s | < 5s |
| JS bundle size per route | < 100KB | < 200KB |
| API response p95 | < 400ms | < 1s |
| AI insight generation p95 | < 4s | < 10s (with loading state) |

Monitor via Vercel Speed Insights + Sentry performance. See [13-deployment-ops.md](13-deployment-ops.md).

---

## Scalability notes (not premature, just planned)

We don't need to scale on day one. But the architecture supports it:

- **Stateless app servers** — Vercel handles autoscaling.
- **Read replicas** — Supabase supports this when we hit the limit (~10k DAU likely fine on a single instance).
- **CDN for static assets** — Vercel default.
- **Prompt caching on Claude** — keeps AI costs flat as users grow.
- **Edge functions for hot reads** — QOD lookup, public landing — can be moved to edge if needed.

If we ever outgrow Supabase: we're on standard Postgres, so migrating to RDS/Neon/etc. is feasible.

---

**See next:** [02-database-schema.md](02-database-schema.md) for the actual data model.
