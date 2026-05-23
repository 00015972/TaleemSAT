# 05 — Security

> Auth, RLS, secrets, rate limiting, threat model, compliance.
> Cross-refs: [02-database-schema.md](02-database-schema.md) · [03-api-reference.md](03-api-reference.md)

---

## Threat model — who we're defending against

| Adversary | Capability | What they want | Our control |
|---|---|---|---|
| Casual cheater (student) | Browser dev tools, can see network traffic | Inflate their points, see explanations without answering, bypass quota | All answer validation server-side; explanations gated until attempt submitted; quota enforced in DB |
| Curious student | Can read source maps if we ship them | See "secret" features, find unpublished questions | RLS blocks reads of unpublished questions; no secrets in client code |
| Refund-abuse | Sign up, use, refund | Free access | Stripe refund policy + chargeback monitoring |
| Bot / scraper | Mass requests | Mirror our question bank | Rate limiting + Cloudflare bot detection + watermarked content (future) |
| Account takeover | Phishing / leaked password | Steal someone's subscription | Standard auth practices: bcrypt via Supabase, suggest 2FA later |
| Compromised admin account | Has admin role | Modify questions, see all users | Hardware MFA mandatory for admins; audit log of admin actions |
| Insider (me) | Full DB access | (n/a — we trust ourselves) | But: log destructive ops, backups offsite |

We are **not** defending against:
- Nation-state APTs
- Physical theft of dev machines (use disk encryption, but no zero-trust assumed)
- Insider abuse by a future hire (revisit when we have hires)

---

## Authentication

### Supabase Auth handles
- Password hashing (bcrypt)
- Email/password sign-up + login
- Email verification (toggle on at launch)
- Password reset flow via email
- Session management via secure HTTP-only cookies
- Refresh token rotation

### Our policy
- **Minimum password length:** 8 characters. (Supabase default; not the strongest, but balanced against student UX.)
- **Email verification:** Required before first practice session. New users can land on dashboard but see "Verify your email" banner until they click the link.
- **Session length:** 7 days, sliding window. Re-verify on sensitive actions (subscription cancel, account delete).
- **MFA:** Optional for students (Phase 10). **Mandatory for admins** (via Supabase TOTP).

### Login attempt limits
- Supabase rate-limits failed logins per email + IP automatically.
- We additionally apply Upstash rate limit on `/api/auth/*` (see [03-api-reference.md](03-api-reference.md)).

### Account recovery
- Password reset: standard "click link in email" flow, link expires in 1 hour.
- Lost email access: **manual review** — user emails support, we verify identity via subscription receipts, etc. No automated path.

---

## Authorization

Two role levels: `student` (default) and `admin`. Defined in `users.role`.

### How role is checked
- **Server-side:** every admin route calls `requireAdmin(session)` which throws `FORBIDDEN` if not.
- **Database:** RLS policies on tables that allow admin overrides reference `auth.jwt() -> 'user_metadata' -> 'role'` (set by trigger when role changes).
- **Client-side:** UI hides admin links if `user.role !== 'admin'`, but this is **UX only** — never rely on client-side checks for security.

### Tier checks (Pro / Elite gating)
- `useTier()` hook reads from `users.tier`.
- Server endpoints requiring Pro+ check tier in code before doing the expensive work:
  ```ts
  if (!['pro', 'elite'].includes(user.tier)) {
    return error('TIER_INSUFFICIENT', 402);
  }
  ```
- AI insights, PDF certificate downloads, mock tests gated this way.

---

## Row-Level Security (RLS)

**Every table has RLS enabled. Default-deny.** Policies summarized in [02-database-schema.md](02-database-schema.md); full SQL in `drizzle/migrations/`.

### Principles
1. **Users can only read/write their own rows.** `auth.uid() = user_id` is the most common policy.
2. **Sensitive writes are server-only.** Points ledger, certificates, subscriptions — no client writes ever.
3. **Public read-only data is explicit.** Questions are readable by anyone authenticated, but only `status = 'published'`.
4. **Admin overrides are explicit, not implicit.** Every admin-only policy lists the admin check.

### How we test RLS
- For each table, write a SQL test that:
  - As anon: confirms reads/writes denied
  - As user A: confirms reads of A's data work, B's data denied
  - As admin: confirms all reads work
- Tests run on every migration via CI (see [12-testing-strategy.md](12-testing-strategy.md)).

---

## Secrets management

### Where secrets live
| Secret | Where | Who has it |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars, Supabase dashboard | Mirsodiq only |
| `ANTHROPIC_API_KEY` | Vercel env vars | Mirsodiq only |
| `STRIPE_SECRET_KEY` | Vercel env vars, Stripe dashboard | Mirsodiq only |
| `STRIPE_WEBHOOK_SECRET` | Vercel env vars, Stripe dashboard | Mirsodiq only |
| `RESEND_API_KEY` | Vercel env vars, Resend dashboard | Mirsodiq only |
| OAuth provider keys (if added) | Vercel env vars | Mirsodiq only |

### Rules
- **Never** commit secrets to git. `.env.local` in `.gitignore`.
- **Never** expose service-role keys to the client. Only `NEXT_PUBLIC_*` vars are sent to the browser, and we never prefix a service key with that.
- **Rotate quarterly** by default. Rotate immediately if a leak is suspected.
- **Audit access:** review who has Vercel/Supabase/Stripe access every 90 days.

### .env.local template (committed as `.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ELITE_PRICE_ID=

RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@taleemsat.com

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

SENTRY_DSN=

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Input validation

- **Every API route** validates body with Zod. Schemas live next to the route.
- **Client-side validation is for UX**, server-side is for security.
- **Sanitize HTML inputs** before rendering. Question text and explanations may contain limited HTML (`<em>`, `<sup>`, etc.) — we use DOMPurify with an allowlist.
- **No raw user input in SQL.** Always parameterized queries (Drizzle + Supabase client both do this by default).

---

## XSS / CSRF / CSP

### XSS
- Default Next.js + React escapes by default.
- For rich-text rendering (question explanations), we sanitize with DOMPurify.
- Content Security Policy header set in `next.config.js`:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.posthog.com https://*.sentry.io`
  - `connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com`
  - `img-src 'self' data: https://*.supabase.co`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' https://fonts.gstatic.com`
  - `frame-src https://js.stripe.com https://checkout.stripe.com`

### CSRF
- Supabase Auth uses `SameSite=Lax` cookies which protect against most CSRF.
- For state-changing operations, ensure the cookie is present (handled automatically by `getSession()`).
- Stripe webhooks verify by signature, not cookie.

### Other headers (`next.config.js`)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Rate limiting

Implemented via Upstash Redis + middleware. Limits documented in [03-api-reference.md](03-api-reference.md).

### Key abuse vectors
- **Mass signup:** 5 signups per IP per hour
- **Login brute force:** 10 attempts per email per 15 min (Supabase default + our overlay)
- **QOD answer spam:** 5 per user per hour (prevents fast spam-clicking through options)
- **AI insight abuse (cost):** 10 per user per day
- **Question scraping:** 60 question fetches per user per minute

When limit exceeded: return `429 RATE_LIMITED` with `Retry-After` header.

---

## Data encryption

- **In transit:** TLS 1.2+ enforced by Vercel and Supabase (no plain HTTP).
- **At rest:** Supabase encrypts disks. Postgres column-level encryption not used at launch (overkill).
- **PDFs in Supabase Storage:** private bucket, signed URLs with 1-hour expiry.
- **Backups:** Supabase encrypts backups. Offsite `pg_dump` backups in Backblaze B2 are encrypted client-side (GPG, key only on dev machine + 1Password).

---

## Audit logging

### What we log
- All admin actions (question CRUD, QOD scheduling, user role changes, manual points adjustments) — written to a future `audit_log` table.
- All authentication events — Supabase logs these.
- All Stripe webhook events — `stripe_events` table.
- All `points_ledger` entries (immutable history).

### What we don't log
- Successful student practice attempts (the `attempts` table itself is the audit trail).
- Page views (handled by PostHog, anonymized).

### Retention
- Audit log: 1 year minimum.
- Auth log: per Supabase defaults (90 days).
- Sentry / PostHog: 30–90 days.

---

## Compliance

### GDPR (EU users)
- Email signup form has a clear consent checkbox (`marketing_opt_in`).
- Privacy policy lists data collected + retention.
- **Data subject access request:** Mirsodiq runs `pg_dump --table=users --table=attempts --where="user_id=..." ` and emails JSON.
- **Right to delete:** Soft delete via setting `users.deleted_at`. Hard delete monthly batch job. Stripe customer is anonymized.
- **Data portability:** Same as access request.

### Children's data (COPPA)
- We require 13+ to sign up (in Terms).
- We don't actively collect age, so we don't know if a user is younger. If discovered, we delete the account.

### Payment data (PCI DSS)
- We never see card numbers. Stripe Checkout handles all card data.
- We store only Stripe customer ID and subscription ID — no PAN, CVV, expiry.

---

## Admin security

- Admin accounts require MFA (Supabase TOTP, enforced manually for now).
- Admin sessions expire faster (24h vs 7d for students).
- Admin route audit log captures every action with `(actor_user_id, action, target_id, before, after, timestamp)`.
- No "passwordless" admin login — passwords always required.

---

## Incident response

If something bad happens:

### Severity 1 — Active breach / data leak
1. Rotate ALL secrets immediately (Supabase, Stripe, Anthropic, Resend).
2. Force log-out all users by invalidating all sessions (Supabase Auth admin API).
3. Disable signups and writes by setting a maintenance flag.
4. Investigate via Supabase logs + Sentry + PostHog.
5. Restore from backup if data integrity compromised.
6. Notify affected users within 72 hours (GDPR requirement).
7. Postmortem within 1 week.

### Severity 2 — Bug exposing data to wrong user
1. Take affected feature offline (feature flag).
2. Identify scope: who saw what.
3. Fix + deploy.
4. Notify if PII involved.

### Severity 3 — Performance degradation
1. Check Vercel status + Supabase status.
2. Roll back recent deploy if suspect.
3. Scale up Supabase if DB-bound.

### Severity 4 — Single-user issue
- Standard support response.

### Contacts
- Supabase support: dashboard → support, paid plan = 1-hour SLA
- Vercel support: dashboard → support
- Stripe support: dashboard
- Anthropic: support@anthropic.com

---

## Vulnerability disclosure

We don't have a public bug bounty yet. Add `/security.txt` at launch with email `security@taleemsat.com` so researchers can responsibly disclose.

---

## Pre-launch security checklist

- [ ] All RLS policies tested (positive + negative cases)
- [ ] All secrets in Vercel, none in git
- [ ] HTTPS forced (HSTS preload)
- [ ] CSP header verified in production response
- [ ] Stripe webhook signature verification working
- [ ] No `console.log` of secrets in client code
- [ ] Rate limits applied to all sensitive routes
- [ ] Email verification enabled
- [ ] Admin MFA enforced
- [ ] Privacy policy + Terms published
- [ ] Cookie banner if targeting EU
- [ ] Sentry filters out sensitive fields from breadcrumbs
- [ ] PostHog person properties exclude PII beyond email
- [ ] Backups restoring successfully (do a drill)
- [ ] Disaster recovery runbook documented (see [13-deployment-ops.md](13-deployment-ops.md))

---

**See next:** [06-design-system.md](06-design-system.md) for what the UI looks like.
