# 03 — API Reference

> Every API endpoint. Auth requirements, request/response schemas, error codes.
> Cross-refs: [02-database-schema.md](02-database-schema.md) · [05-security.md](05-security.md)

---

## Conventions

### Base URL
- Local: `http://localhost:3000/api`
- Prod: `https://taleemsat.com/api`

**Why `/api/`?** In Next.js App Router, route handlers live under `app/api/` and are served at `/api/*`. This prefix clearly separates data endpoints from rendered pages and avoids URL collisions (e.g., `/qod` is a student page; `/api/qod/today` is its data endpoint). When we add mobile app support, we'll namespace as `/api/v1/*` and freeze that contract.

### Auth
- Session-based via Supabase Auth cookie. The `getSession()` helper reads the cookie and returns the user (or 401).
- No bearer tokens for the web app. Future mobile app may add JWT-based auth.

### Request format
- Method + JSON body. `Content-Type: application/json`.
- All bodies validated server-side with Zod schemas (defined alongside each route in code).

### Response format
**Success:**
```json
{ "ok": true, "data": { ... } }
```

**Error:**
```json
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "Email is required" } }
```

### Error codes (canonical)
| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No session |
| `FORBIDDEN` | 403 | Logged in but lacks permission (e.g. non-admin hitting admin route) |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_FAILED` | 400 | Body failed Zod validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `ALREADY_ANSWERED` | 409 | Conflict — already answered today's QOD |
| `TIER_INSUFFICIENT` | 402 | Feature requires a higher tier |
| `INTERNAL_ERROR` | 500 | Server bug; logged to Sentry |

---

## Auth

### `POST /api/auth/signup`
Create a new user via Supabase Auth, mirror into `users` table via trigger.

**Body:**
```json
{
  "email": "amir@example.com",
  "password": "min8chars",
  "full_name": "Amir Karimov",
  "target_sat_score": 1450,
  "exam_date": "2026-08-24",
  "marketing_opt_in": true
}
```

**Response 200:**
```json
{ "ok": true, "data": { "user_id": "uuid", "redirect": "/dashboard" } }
```

**Errors:**
- `VALIDATION_FAILED` — bad email/password
- `409 EMAIL_TAKEN` — email already in use

**Notes:**
- Triggers the welcome email (see [14-analytics-emails.md](14-analytics-emails.md)).
- Inserts into `email_subscriptions` if `marketing_opt_in = true`.

---

### `POST /api/auth/login`
Handled directly by Supabase Auth client SDK on the frontend (not our own route). Listed here for completeness.

---

### `POST /api/auth/logout`
Handled by Supabase client. Clears cookie.

---

### `POST /api/auth/forgot-password`
Trigger Supabase Auth password reset email. We don't need our own route.

---

## Questions (student-facing reads)

### `GET /api/questions/random?category=<slug>&exclude=<id,id>`
Return one random published question in a category, excluding any IDs in `exclude` (so refresh doesn't repeat). Free users limited to 5 per day per category — count enforced via attempts table.

**Auth:** required.

**Query params:**
- `category` (required) — category slug
- `exclude` (optional) — comma-separated UUIDs

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "question": {
      "id": "uuid",
      "passage": "...",
      "question_text": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "difficulty": "medium"
    }
  }
}
```

**Note:** `correct_answer` and `explanation` are **never** sent until after the student submits an attempt.

**Errors:**
- `TIER_INSUFFICIENT` — free user exceeded daily quota
- `NOT_FOUND` — no published questions in category

---

### `GET /api/questions/:id`
Fetch a single question. Used after attempt submission to show the explanation.

**Auth:** required. User must have an attempt for this question (otherwise we don't reveal explanation).

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "question": { "...full question..." },
    "correct_answer": "B",
    "explanation": "..."
  }
}
```

---

## Attempts

### `POST /api/attempts`
Submit an answer to a practice question.

**Auth:** required.

**Body:**
```json
{
  "question_id": "uuid",
  "selected_answer": "B",
  "time_taken_ms": 24500,
  "context": "practice"
}
```

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "attempt_id": "uuid",
    "correct": false,
    "correct_answer": "C",
    "explanation": "...",
    "quota_remaining": 4
  }
}
```

**Notes:**
- Server looks up `correct_answer` server-side (client can't spoof it).
- Increments daily quota counter for free-tier users.
- `quota_remaining` only present for free tier.

---

### `GET /api/attempts/history?context=practice&limit=20`
Paginated history of attempts for the analytics page.

**Auth:** required.

**Query params:**
- `context` — `practice` | `qod` | `mock` | `all` (default: all)
- `category_id` — optional filter
- `limit` — default 20, max 100
- `cursor` — opaque cursor for pagination

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "attempts": [ { "id": "...", "question_id": "...", "is_correct": true, "created_at": "..." } ],
    "next_cursor": "opaque"
  }
}
```

---

## Question of the Day

### `GET /api/qod/today`
Get today's QOD. Returns the user's own answer if already answered.

**Auth:** required.

**Response 200 (not yet answered):**
```json
{
  "ok": true,
  "data": {
    "question": { "id": "...", "passage": "...", "question_text": "...", "options": {...} },
    "category_name": "Standard English Conventions",
    "difficulty": "hard",
    "answered": false,
    "user_points": 18,
    "next_certificate_at": 25
  }
}
```

**Response 200 (already answered):**
```json
{
  "ok": true,
  "data": {
    "question": { "...full..." },
    "answered": true,
    "selected_answer": "C",
    "is_correct": false,
    "correct_answer": "A",
    "explanation": "...",
    "points_awarded": 0,
    "user_points": 18
  }
}
```

---

### `POST /api/qod/answer`
Submit an answer to today's QOD.

**Auth:** required.

**Body:**
```json
{ "selected_answer": "A" }
```

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "correct": true,
    "correct_answer": "A",
    "explanation": "...",
    "points_awarded": 1,
    "user_points": 19,
    "streak_days": 5,
    "certificate_earned": null
  }
}
```

**Errors:**
- `ALREADY_ANSWERED` — user already answered today

**Notes:**
- If hitting a 25-pt milestone, `certificate_earned: { id, tier: 25 }` is returned and triggers PDF generation in the background.
- Updates `users.streak_days` and `users.last_qod_answered_at`.

---

## Certificates

### `GET /api/certificates`
List the user's certificates.

**Auth:** required.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "certificates": [
      { "id": "uuid", "tier": 25, "awarded_at": "2026-04-15T...", "pdf_ready": true }
    ],
    "current_points": 18,
    "next_tier": 25
  }
}
```

---

### `GET /api/certificates/:id/pdf`
Stream the certificate PDF. Generates on-demand if not yet generated; otherwise serves from Supabase Storage.

**Auth:** required. User must own the certificate (or be admin).

**Response 200:**
- `Content-Type: application/pdf`
- Binary stream

**Errors:**
- `FORBIDDEN` — not the cert owner
- `TIER_INSUFFICIENT` — free tier can earn certs but cannot download (paywall)

---

## Analytics & AI

### `GET /api/analytics/overview`
Performance breakdown for the analytics page.

**Auth:** required.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "overall_accuracy": 0.68,
    "total_attempts": 142,
    "streak_days": 4,
    "by_subject": {
      "english": { "accuracy": 0.76, "attempts": 81 },
      "math": { "accuracy": 0.61, "attempts": 61 }
    },
    "by_category": [
      { "category_id": "...", "name": "Craft & Structure", "accuracy": 0.58, "attempts": 24 }
    ]
  }
}
```

---

### `GET /api/ai/insights`
Pro/Elite only. Returns cached AI insight or generates a new one.

**Auth:** required. Tier: pro or elite.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "computed_at": "2026-05-10T08:00:00Z",
    "expires_at": "2026-05-11T08:00:00Z",
    "insights": [
      {
        "kind": "weakness",
        "category": "Advanced Math",
        "headline": "Quadratic equations are your weak spot.",
        "body": "3 of your last 5 errors involved factoring quadratics...",
        "recommendation": "Spend 15 min/day on this category until your exam."
      }
    ]
  }
}
```

**Errors:**
- `TIER_INSUFFICIENT` — free tier
- `INTERNAL_ERROR` — Claude unreachable; UI should degrade gracefully

See [09-ai-features.md](09-ai-features.md) for the prompt.

---

## Subscriptions / Payme

### `POST /api/payme/create-invoice`

Create a Payme payment invoice for a subscription purchase.

**Auth:** required.

**Body:**
```json
{ "tier": "pro" }
```

**Response 200:**
```json
{ "ok": true, "data": { "checkout_url": "https://checkout.payme.uz/?m=...&a=..." } }
```

**Notes:**

- Amount is in tiyin (UZS × 100), read from `PAYME_PRO_AMOUNT_TIYIN` / `PAYME_ELITE_AMOUNT_TIYIN`.
- Creates a `payme_transactions` row with `status = 'pending'`.
- Redirect user to `checkout_url`; Payme calls our webhook when payment completes.

---

### `POST /api/payme/webhook`
Receive JSONRPC calls from Payme (PerformTransaction, CancelTransaction, CheckTransaction).

**Auth:** `Authorization: Basic <base64(merchant_id:secret_key)>` — verified before processing.

**Events handled:**

- `PerformTransaction` → activate subscription, set `current_period_end = now + 30d`, send welcome email
- `CancelTransaction` → mark transaction canceled, no tier change
- `CheckTransaction` → return current transaction state (required by Payme protocol)

**Idempotency:** Transaction ID from Payme is stored in `payme_transactions.payme_transaction_id`; duplicate calls return the current state without re-processing.

---

## Subscriptions / Stripe

### `POST /api/stripe/checkout`
Create a Stripe Checkout session for upgrading.

**Auth:** required.

**Body:**
```json
{ "tier": "pro" }
```

**Response 200:**
```json
{ "ok": true, "data": { "checkout_url": "https://checkout.stripe.com/..." } }
```

**Notes:**
- Creates or reuses Stripe customer.
- Includes `client_reference_id = user.id` so the webhook can map back.
- 30% discount coupon is applied automatically if user has joined a Telegram course (future feature, gated by a `course_member` flag).

---

### `POST /api/stripe/portal`
Create a Stripe Billing Portal session (manage subscription, update card, cancel).

**Auth:** required. User must have an active subscription.

**Response 200:**
```json
{ "ok": true, "data": { "portal_url": "https://billing.stripe.com/..." } }
```

---

### `POST /api/stripe/webhook`
Receive events from Stripe. Verifies signature.

**Auth:** Stripe signature header (not session-based).

**Events handled:**
- `checkout.session.completed` → activate subscription
- `customer.subscription.updated` → sync status, tier, period_end
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → mark `past_due`, email user

**Idempotency:** dedup via `stripe_events` table — see [02-database-schema.md](02-database-schema.md).

---

## Admin endpoints

All admin endpoints check `user.role === 'admin'` before doing anything else. Returns `FORBIDDEN` if not.

### `GET /api/admin/questions?status=published&category_id=...&q=search`
List questions for the admin table.

### `POST /api/admin/questions`
Create a new question.

**Body:** all fields from `questions` table except `id`, `created_at`, `updated_at`.

### `PATCH /api/admin/questions/:id`
Update an existing question.

### `DELETE /api/admin/questions/:id`
Soft-archive (sets `status = 'archived'`). Hard delete only via Supabase SQL editor.

### `POST /api/admin/questions/import`
Bulk import via CSV.

**Body:** multipart/form-data with a `file` field. See [11-content-pipeline.md](11-content-pipeline.md) for CSV format.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "imported": 187,
    "skipped": 13,
    "errors": [ { "row": 14, "reason": "Missing correct_answer" } ]
  }
}
```

### `GET /api/admin/qod`
List scheduled QODs (past + upcoming).

### `POST /api/admin/qod`
Schedule a QOD for a future date.

**Body:**
```json
{ "scheduled_date": "2026-05-15", "question_id": "uuid" }
```

### `DELETE /api/admin/qod/:id`
Unschedule (only allowed for future dates).

### `GET /api/admin/users?tier=pro&search=...`
List users with filters.

### `PATCH /api/admin/users/:id`
Update user (admin overrides: tier, role, points adjustment via `points_ledger`).

**Body:** any of `{ tier, role, full_name }` — sensitive changes are logged.

### `GET /api/admin/stats`
Dashboard overview metrics.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "total_users": 482,
    "active_subscribers": 47,
    "dau": 124,
    "wau": 318,
    "mau": 481,
    "questions_count": 200,
    "attempts_last_24h": 1843,
    "qod_today_responses": 89,
    "qod_today_accuracy": 0.62
  }
}
```

---

## Public endpoints (no auth)

### `POST /api/lead`
Capture an email from the landing page (without full signup).

**Body:**
```json
{ "email": "x@example.com", "source": "landing" }
```

**Rate-limited:** 5/hour per IP.

---

## Rate limits (Upstash-backed)

| Route pattern | Limit | Per |
|---|---|---|
| `POST /api/auth/signup` | 5 | per IP per hour |
| `POST /api/auth/login` (via Supabase) | 10 | per email per 15 min |
| `POST /api/attempts` | 60 | per user per minute |
| `POST /api/qod/answer` | 5 | per user per hour |
| `GET /api/ai/insights` | 10 | per user per day |
| `POST /api/lead` | 5 | per IP per hour |
| Everything else | 120 | per user per minute |

See [05-security.md](05-security.md) for the abuse model.

---

## Versioning

We don't version the API yet. When we add a mobile app or third-party integrations, introduce `/api/v1/*` and freeze it.

---

**See next:** [04-feature-roadmap.md](04-feature-roadmap.md) for the build order.
