# 13 — Deployment & Operations

> Hosting, CI/CD, environments, migrations, monitoring, runbooks.
> Cross-refs: [01-architecture.md](01-architecture.md) · [05-security.md](05-security.md)

---

## Hosting overview

| Service | Hosts | Plan at launch |
|---|---|---|
| **Vercel** | Next.js app | Hobby → Pro when DAU > 200 |
| **Supabase** | Postgres + Auth + Storage | Pro ($25/mo for backups + custom domain) |
| **Cloudflare** | DNS + CDN proxy (optional) | Free |
| **GitHub** | Source code + Actions CI | Free |
| **Sentry** | Error tracking | Free tier (10k errors/mo) |
| **PostHog** | Product analytics | Free tier (1M events/mo) |
| **Upstash** | Redis for rate limiting | Free tier (10k commands/day) |
| **Resend** | Email | Free → $20/mo when above 3k/mo |
| **Stripe** | Payments | Pay-per-transaction (2.9% + $0.30) |

**Estimated monthly cost at launch:** ~$50–80 (Supabase Pro is the main line item).
**At 500 paid users:** ~$250–400 (mostly Supabase scaling + Resend volume).

---

## Environments

### Three environments, all with separate everything

| | Local | Staging | Production |
|---|---|---|---|
| URL | `localhost:3000` | `staging.taleemsat.com` | `taleemsat.com` |
| Branch | any | `staging` | `main` |
| Supabase project | `taleem-dev` | `taleem-staging` | `taleem-prod` |
| Stripe mode | Test | Test | Live |
| Resend domain | `dev.taleemsat.com` | `staging.taleemsat.com` | `taleemsat.com` |
| Sentry env | `local` | `staging` | `production` |
| PostHog | dev project | staging project | prod project |

**Rule:** Production data never touches non-prod environments. If we need realistic data in staging, we use anonymized exports.

### Preview environments
- Every PR gets a Vercel preview deployment.
- Preview uses **staging** Supabase + Stripe (so multiple PRs share data — fine for testing).
- Preview URLs auto-posted as PR comments.

---

## CI/CD

### Branch model
- `main` → production (auto-deploy on merge)
- `staging` → staging environment (auto-deploy on push)
- Feature branches → preview deploys per PR
- Hotfix branches → PR to `main`, fast-track review

### GitHub Actions workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main, staging]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
        env: { DATABASE_URL: postgres://postgres:postgres@localhost/postgres }
      - run: pnpm test:integration

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm audit --prod --audit-level high
```

### Deploy flow

```
PR opened
   ↓
   CI runs (lint, unit, integration, security)
   Vercel builds preview
   ↓
Merge to staging branch
   ↓
   Vercel deploys to staging.taleemsat.com
   Smoke tests against staging
   ↓
Merge staging → main
   ↓
   Vercel deploys to taleemsat.com
   PostHog deploy event fired
   Sentry deploy event fired
```

### Deploy frequency
- **Multiple times per day** is the goal. Small batches = fewer surprises.
- No "deploy day" — anytime CI passes and you've manually smoke-tested, ship it.

---

## Database migrations

### Tool
Drizzle Kit handles migrations.

### Workflow
1. Modify schema in `drizzle/schema.ts`
2. Run `pnpm db:generate` → creates new migration SQL file
3. Inspect generated SQL — fix anything Drizzle got wrong
4. Run `pnpm db:migrate` locally to apply
5. Test locally
6. Commit migration file to git
7. CI runs migrations against test DB
8. Merge to staging → migrations auto-apply to staging Supabase
9. Test on staging
10. Merge to main → migrations auto-apply to prod Supabase

### Migration rules
- **Forward-compatible.** Old running code must work with the new schema for a few minutes after deploy.
  - Adding a column: ✅
  - Adding a nullable column with a default: ✅
  - Dropping a column: ❌ — split into two migrations (deploy code that doesn't read it, then drop in next deploy)
  - Renaming: ❌ — same as dropping. Add new, copy data, drop old.
- **No data migrations in schema migrations.** Run those as separate scripts so they're reviewable.
- **Reversible when possible.** Each migration has a `down` script. We rarely use it but it's documented.
- **Test on staging first. Always.**
- **Never edit a migration after it's been applied.** Add a new one.

### Big migration playbook
For risky changes (e.g., restructuring a table with millions of rows):
1. Write the migration locally
2. Test against a copy of prod data
3. Schedule a maintenance window
4. Run during low-traffic time
5. Have rollback ready
6. Monitor for 1 hour after

---

## Secrets / env vars

### Where they live
- Local: `.env.local` (gitignored)
- Vercel: project settings → Environment Variables (separate per env: preview/staging/production)
- GitHub Actions: repository secrets

### Rotation
- Quarterly schedule (March, June, September, December)
- Immediately if a leak is suspected
- After any team member changes (Phase 10+)

### Per-secret rotation
| Secret | Rotation impact |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Update in Vercel + GitHub. Next deploy uses new key. |
| `STRIPE_SECRET_KEY` | Old key still works for ~24h. Update + deploy. |
| `STRIPE_WEBHOOK_SECRET` | Update endpoint signing secret in Stripe dashboard first, then in Vercel. |
| `ANTHROPIC_API_KEY` | Generate new in Anthropic console, update Vercel, delete old after 24h. |
| `RESEND_API_KEY` | Same pattern. |

---

## Monitoring

### What we watch

| Tool | Watches | Alerts on |
|---|---|---|
| **Sentry** | Errors, performance traces | Error rate > 1% over 5 min, new error type, p95 latency > 1s |
| **Vercel Analytics** | Web vitals, page views | LCP regression, traffic drop |
| **PostHog** | Events, sessions, funnels | Daily active users drop |
| **Supabase dashboard** | DB performance, query stats | Slow queries (> 1s), CPU > 80% |
| **Stripe dashboard** | Payment failures, disputes | Spike in failed payments |
| **Uptime monitor** (e.g., Better Stack) | Site availability | Site down > 1 minute |

### Alert routing
- **Critical (P0/P1):** Email + push notification to Mirsodiq's phone.
- **Important (P2):** Daily digest email.
- **Info:** Logged only, reviewed weekly.

### Dashboards
- **Mirsodiq's monitor:** custom dashboard combining the above (PostHog scratchpad).
- **Admin panel:** key product metrics for Bahromjon (DAU, conversion, etc.).
- **Sentry release health:** crash-free rate per release.

---

## Logging

### Application logs
- `console.log` in development.
- `console.error` in production goes to Vercel logs + Sentry breadcrumbs.
- Structured logs preferred: `console.log(JSON.stringify({ event, user_id, ... }))`.

### Don't log
- Passwords, API keys, full credit cards, full session tokens
- PII beyond user ID (no emails, names in logs)

### Retention
- Vercel logs: 30 days (Pro plan)
- Sentry: 30 days
- Supabase logs: 7–30 days

---

## Backup strategy

### Supabase Point-In-Time Recovery (PITR)
- Pro plan: 7-day PITR enabled.
- Can restore to any second within the last 7 days.

### Weekly logical backups
- GitHub Action runs `pg_dump` every Sunday.
- Encrypts with GPG (recipient key stored on dev machine + 1Password).
- Uploads to Backblaze B2 bucket `taleemsat-backups`.
- Retention: 12 weeks rolling.

### Monthly cold backup
- First Sunday of each month, the weekly backup is moved to long-term storage.
- Retention: 24 months.

### Disaster recovery (DR) drill
- Quarterly: restore a backup to a test Supabase project, verify app boots, key queries work.
- Document any issues found in the drill log.

### Recovery Time Objective (RTO) / Recovery Point Objective (RPO)
- **RTO:** 4 hours (time to fully restore service)
- **RPO:** 1 hour (max data loss acceptable in disaster)

PITR enables RPO well below 1 hour.

---

## Runbooks

Step-by-step instructions for the most likely incidents.

### Runbook 1: Site is down

1. Check [vercel-status.com](https://vercel-status.com) — Vercel down?
2. Check [supabase-status.com](https://supabase-status.com) — Supabase down?
3. Check Sentry for error spike — recent deploy broke?
4. If Vercel/Supabase down: post status update on Twitter/Telegram, wait.
5. If our code: revert last deploy from Vercel dashboard (1 click).
6. Investigate root cause, fix, redeploy.

### Runbook 2: Stripe webhook stopped working

1. Check `/admin/subscriptions` for events arriving — are recent events listed?
2. Check Sentry for `stripe.webhook.*` errors.
3. In Stripe dashboard → Developers → Webhooks → our endpoint → see recent delivery attempts.
4. If signature errors: webhook secret changed and we didn't update — fix env var, redeploy.
5. If 500 errors: investigate the handler. May need to manually replay missed events via Stripe dashboard.

### Runbook 3: Emails not delivering

1. Check Resend dashboard — recent sends shown?
2. Check Resend logs for bounces / spam complaints.
3. Verify domain DNS records (SPF, DKIM, DMARC) in Resend dashboard.
4. If DNS issue: fix in Cloudflare DNS.
5. If reputation issue: send fewer emails for a few days, investigate why marked as spam.

### Runbook 4: Database is slow

1. Check Supabase dashboard → Database → Query Performance.
2. Identify slow queries.
3. Likely cause: missing index. Add it.
4. If urgent: scale up Supabase plan temporarily.
5. Investigate root cause (sudden traffic? N+1 query? large scan?).

### Runbook 5: AI costs spike

1. Check Anthropic console → Usage.
2. Identify which endpoint / user pattern caused it.
3. If abuse: rate-limit harder, possibly block the user.
4. If bug: revert recent deploys, fix.
5. Set tighter per-user caps.

### Runbook 6: Security incident (suspected breach)

1. Don't panic. Don't power things off until you're sure.
2. Rotate **all secrets** in Vercel + provider dashboards.
3. Force-logout all users (Supabase auth admin API).
4. Disable signups + writes (feature flag).
5. Investigate scope via Sentry + Supabase logs.
6. Restore from backup if data integrity compromised.
7. Notify affected users within 72h (GDPR).
8. Write postmortem within 1 week.

See [05-security.md](05-security.md) for fuller incident response.

### Runbook 7: Restore a single deleted record

(For when a user emails "I lost my certificate")

1. Identify the user + record they lost.
2. Use Supabase SQL editor with service role.
3. Query historical state via PITR if needed.
4. Restore the specific row.
5. Email user confirmation.

---

## Maintenance mode

We don't have a public maintenance mode at launch. If we need one:

- Feature flag `MAINTENANCE_MODE=true` in Vercel env vars.
- Middleware returns a static maintenance page for all requests except `/api/admin/*` and `/admin/*`.
- Admin can monitor + work during maintenance.

---

## Performance ops

### When the app is slow

1. Check Vercel Function logs for slow API routes.
2. Check Supabase slow query log.
3. Add indexes if needed.
4. Cache aggressively at the edge (route segment config `revalidate`).
5. If a hot read can be cached longer (e.g., today's QOD), use `unstable_cache`.

### Scaling Supabase
- Free → Pro: 8GB DB, 100k MAU, daily backups, 7-day PITR.
- Pro → Team: when we need 100GB DB or > 100k MAU.

### Vercel concurrency
- Hobby: 10 concurrent builds, fine until ~100 RPS.
- Pro: unlimited, when we have actual traffic.

---

## Cost monitoring

Monthly cost review (last Friday of every month):
- [ ] Vercel bandwidth + function invocations
- [ ] Supabase plan + add-ons
- [ ] Anthropic token usage
- [ ] Stripe processing fees
- [ ] Resend email count
- [ ] Other (domain, monitoring tools)

Goal: keep cost per active user < $0.50.

---

## Domains & DNS

- **Primary:** `taleemsat.com` (purchased via Cloudflare Registrar or Namecheap)
- **Staging:** `staging.taleemsat.com`
- **API:** served from `taleemsat.com/api` (no separate subdomain)
- **Mail:** SPF/DKIM/DMARC records for Resend
- **Cloudflare:** proxies traffic (DDoS + caching), DNS provider

DNS records to set up at launch:
- `A taleemsat.com → 76.76.21.21` (Vercel)
- `CNAME www → cname.vercel-dns.com`
- `CNAME staging → cname.vercel-dns.com`
- `MX taleemsat.com → 10 feedback-smtp.us-east-1.amazonses.com` (Resend)
- `TXT taleemsat.com → "v=spf1 include:_spf.resend.com ~all"`
- `TXT resend._domainkey.taleemsat.com → "k=rsa; p=..."` (from Resend dashboard)
- `TXT _dmarc.taleemsat.com → "v=DMARC1; p=quarantine; rua=mailto:dmarc@taleemsat.com"`

---

## SSL / HTTPS

- Automatic via Vercel + Cloudflare.
- TLS 1.2+ enforced.
- HSTS preload list submission post-launch.

---

## Pre-launch ops checklist

- [ ] Production Supabase project created, schema migrated, RLS verified
- [ ] Production Stripe in live mode, products created, webhook endpoint registered
- [ ] Production Resend domain verified, DKIM passing
- [ ] Vercel project connected, custom domain configured
- [ ] All env vars set in Vercel production
- [ ] Sentry + PostHog production projects connected
- [ ] Uptime monitor configured (Better Stack or similar)
- [ ] Backups confirmed running
- [ ] First DR drill completed
- [ ] Privacy + Terms pages live
- [ ] Cookie banner (if targeting EU)
- [ ] DNS fully propagated, HTTPS working everywhere
- [ ] First admin user created with MFA
- [ ] Smoke test in production passes (Stripe live test with real card $1)

---

**See next:** [14-analytics-emails.md](14-analytics-emails.md) for how we measure success + talk to users.
