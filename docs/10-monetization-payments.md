# 10 — Monetization & Payments

> Pricing tiers, Stripe integration, subscription lifecycle, refunds.
> Cross-refs: [03-api-reference.md](03-api-reference.md) · [02-database-schema.md](02-database-schema.md) · [05-security.md](05-security.md)

---

## Business model

**Freemium SaaS, monthly subscriptions, with three tiers.**

- Free tier converts students into the daily habit.
- Pro tier is the price-elastic core revenue.
- Elite tier captures motivated test-takers in the final stretch.
- Telegram course discount creates an off-platform cross-sell.

We do **not** rely on:

- Ads (would dilute brand)
- One-time purchases (subscriptions = predictable MRR)
- Free trials at launch (revisit later — adds complexity)

---

## Tier specification

### Free — $0

**Tagline:** "For curious students, just getting started."

| Feature | Detail |
|---|---|
| Question of the Day | ✅ Daily |
| Practice questions | 5/day total (across all categories) |
| Answer explanations | ❌ |
| QOD points + earn certificates | ✅ Earn — but cannot download PDF |
| Performance dashboard | Basic stats only |
| AI insights | ❌ |
| Mock SAT tests | ❌ |
| Exam countdown | ✅ |
| Telegram course discount | ❌ |

**Conversion lever:** Answer explanations are the #1 thing free users want. We make them visible behind a paywall ("Get full explanations with Pro").

---

### Pro — $12/month

**Tagline:** "For students preparing seriously, on their own."

| Feature | Detail |
|---|---|
| Everything in Free | ✅ |
| Practice questions | ♾ Unlimited |
| Full answer explanations | ✅ |
| PDF certificate download | ✅ |
| Performance analytics | ✅ Full |
| AI weakness detection | ✅ |
| Mock SAT tests | ❌ |
| Telegram course discount | ✅ 30% off |

**Conversion lever from Pro → Elite:** Mock SAT tests are the killer feature for students approaching test day.

---

### Elite — $25/month

**Tagline:** "For test-takers in the final stretch."

| Feature | Detail |
|---|---|
| Everything in Pro | ✅ |
| AI personalized study plan | ✅ |
| Full timed mock SAT tests | ✅ |
| Section-level score predictions | ✅ |
| Priority support (Telegram) | ✅ |
| Monthly progress review | ✅ |
| Telegram course discount | ✅ 30% off |

---

## Pricing rationale

Quick math:
- $12/mo × 12 = $144/year. Compare to test-prep books at $30 or tutoring at $50/hour.
- $25/mo × 3 months (typical test-prep cycle) = $75. Compare to Khan Academy (free but generic) or expensive tutoring.

Why $12 not $9 or $15:
- $9.99 felt cheap (devalues the product).
- $14.99 reduces conversion based on competitive pricing.
- $12 is the sweet spot: feels intentional, not bargain-bin, accessible to students.

Why $25 for Elite:
- 2× Pro creates clear "step up" perception.
- $25 is what motivated students pay for tutoring per hour — easy mental comparison.
- Captures the "I need to fix my SAT before May" willingness-to-pay.

### Currency
Primary: USD. UZS (Uzbek Som) shown converted at checkout for clarity.

Pricing in UZS may launch later as a separate price book if Stripe supports our region well.

---

## Payment provider strategy

We run two payment providers side-by-side:

| Provider | Who uses it | Why |
|---|---|---|
| **Payme** | Uzbek users (Uzcard, Humo, local Visa/MC) | Dominant payment app in Uzbekistan — far higher conversion than international checkout |
| **Stripe** | International users (non-UZ cards) | Handles VAT, SCA, currency conversion; industry standard |

At checkout the UI detects the user's country (from signup or IP) and shows the appropriate payment button. Users can override.

---

## Payme integration

### What is Payme

[Payme](https://payme.uz) is Uzbekistan's leading payment system. It supports Uzcard, Humo, Visa, and Mastercard issued by Uzbek banks. Most Uzbek users have the Payme mobile app and expect to pay via it.

### Payme subscription model

Payme's API supports one-time payments natively. **Recurring / auto-renewing subscriptions are not a built-in feature** — this is the key difference from Stripe.

Options for recurring billing via Payme:

1. **Manual renewal with reminders (launch approach):** Charge one month at a time. 3 days before expiry, email + in-app prompt: "Your subscription expires in 3 days. Renew for another month." User taps "Renew" → new Payme payment → extends subscription by 30 days.
2. **Saved card tokenisation (future):** Payme offers card tokenisation. Store the token, charge automatically on renewal date without user interaction — functionally equivalent to Stripe's recurring. Requires Payme merchant agreement that includes recurring charges.

**Decision for launch:** Use option 1 (manual renewal). Simpler to implement, no special merchant agreement needed. If churn from friction is measurable, switch to option 2.

### Payme API overview

Payme uses a JSONRPC-style merchant API (not REST). Key methods:

| Method | What it does |
|---|---|
| `CreateTransaction` | Creates a payment transaction for a given amount |
| `PerformTransaction` | Confirms the transaction after user approves in Payme app |
| `CancelTransaction` | Cancels a pending transaction |
| `CheckTransaction` | Polls transaction state |
| `GetStatement` | Lists transactions in a date range (reconciliation) |

Payme calls **our server** (webhook-style) with these methods — we don't call Payme. We expose a single endpoint:

```
POST /api/payme/webhook
```

Payme signs each request with an `Authorization: Basic <base64(merchant_id:secret_key)>` header. We verify before processing.

### Payme environment variables

```
PAYME_MERCHANT_ID=...
PAYME_SECRET_KEY=...         # test key for dev/staging
PAYME_SECRET_KEY_PROD=...    # live key for production
PAYME_CHECKOUT_URL=https://checkout.payme.uz/...
```

### Payme subscription flow (manual renewal)

```
1. User clicks "Subscribe (Payme)" on /pricing
2. POST /api/payme/create-invoice
   - Creates a transaction record in our DB (status: pending)
   - Returns a Payme checkout URL: https://checkout.payme.uz/?m=<id>&ac.order_id=<our_ref>&a=<amount>
3. Redirect user to Payme checkout page
4. User pays via Payme app or card
5. Payme calls POST /api/payme/webhook with PerformTransaction
6. Webhook handler:
   - Verify Authorization header
   - Match to our pending transaction
   - Update subscription: status=active, current_period_end = now + 30 days
   - Send welcome email via Resend
7. User is redirected to /settings/subscription?activated=true
```

### Renewal reminder flow

```
Cron job runs daily (midnight UTC):
  - Find Payme subscriptions expiring in 3 days
  - Send email: "Your Taleem SAT subscription expires in 3 days"
  - Show in-app banner on dashboard

User clicks "Renew":
  - Same flow as initial subscribe (new invoice, new Payme payment)
  - Extends current_period_end by 30 days

If user does not renew by expiry date:
  - Cron: downgrade to free tier
  - Send "Your subscription has ended" email
```

### Payme amounts

Payme amounts are in **Uzbek tiyin** (1 UZS = 100 tiyin). At launch, we price in UZS with a fixed monthly exchange rate reviewed quarterly.

Example: if $12 USD ≈ 155,000 UZS → Payme amount = `15500000` (tiyin).

The exchange rate is stored in an env var (`PAYME_PRO_AMOUNT_TIYIN`, `PAYME_ELITE_AMOUNT_TIYIN`) and updated manually each quarter.

---

## Stripe setup

### Products (one per tier)
- **Taleem SAT Pro** — product
  - Monthly price: $12.00 USD recurring
- **Taleem SAT Elite** — product
  - Monthly price: $25.00 USD recurring

Annual prices: skipped at launch. Add after first 100 subscribers with a 20% discount.

### Stripe products live in:
- Test mode (dev/staging)
- Live mode (production)

Price IDs are env vars: `STRIPE_PRO_PRICE_ID`, `STRIPE_ELITE_PRICE_ID` (separate values per env).

### Tax
- Stripe Tax enabled — automatically calculates VAT for EU customers.
- Tax shown at checkout, included in invoice.
- For US: state sales tax handled by Stripe Tax.

### Coupons (30% Telegram course discount)
- Create coupon `TELEGRAM30` in Stripe — 30% off recurring forever.
- Manually apply via Stripe dashboard for first batch of course members.
- Phase 7+: automated via a `course_member` flag on users, applied at checkout.

---

## Subscription lifecycle

### Sign-up to subscription
```
1. User clicks "Start Pro" on /pricing
2. POST /api/stripe/checkout
   - Create or retrieve Stripe customer (by users.stripe_customer_id)
   - Create Checkout Session with:
     - mode: subscription
     - line_items: [{ price: PRO_PRICE_ID, quantity: 1 }]
     - client_reference_id: user.id
     - success_url: /settings/subscription?upgraded=true
     - cancel_url: /pricing
3. Redirect user to Stripe Checkout
4. User pays
5. Stripe redirects to success_url
6. Stripe sends checkout.session.completed webhook (in parallel)
7. Webhook handler:
   - Verify signature
   - Upsert subscriptions table
   - Update users.tier, subscription_id, subscription_status, current_period_end
   - Send welcome email via Resend
8. User lands on success page, immediately has Pro access
```

### Recurring renewal
- Stripe charges automatically each month.
- `invoice.payment_succeeded` webhook fires.
- We update `current_period_end` to new value.
- No email by default (Stripe sends its own receipt — we toggle this in dashboard).

### Payment failure
- `invoice.payment_failed` webhook fires.
- Mark `subscription_status = 'past_due'`.
- Send email: "Payment failed. Please update your card."
- Stripe retries automatically (default schedule: 3 attempts over 7 days).
- After all retries fail, Stripe sends `customer.subscription.deleted` → we downgrade to free.

### User-initiated cancellation
- User clicks "Manage subscription" in `/settings/subscription`.
- We open Stripe Billing Portal (hosted).
- User clicks "Cancel" in portal.
- `customer.subscription.updated` webhook with `cancel_at_period_end: true`.
- We set `cancel_at_period_end = true` in our `subscriptions` row.
- User retains Pro access until `current_period_end`.
- Settings page shows: "Pro access until May 28. [Resume]"
- On `current_period_end`, Stripe sends `customer.subscription.deleted` → downgrade.

### User-initiated resume
- Within the cancellation window, "Resume" button.
- Opens Stripe Portal where user clears cancellation.
- Webhook updates our row.

### Upgrade/downgrade between tiers (Phase 10+)
- Stripe handles proration.
- Webhook updates tier immediately.
- For now, users cancel + re-subscribe to change tiers.

---

## Refund policy

**7-day money-back guarantee on the first payment.**

- Within 7 days of first charge: full refund, no questions asked.
- After 7 days: no refunds on past months, but cancellation takes effect at period end (so they keep access for what they've paid).

### Process
- User emails support requesting refund.
- We refund via Stripe dashboard (full or partial).
- Cancel subscription via Stripe portal/dashboard.
- Note in user's admin profile: "Refunded $12 on 2026-05-15, reason: changed mind".
- User account remains active in free tier.

### Chargebacks
- If a user files a chargeback with their bank instead of asking us, we lose the dispute fee + payment.
- Mitigations:
  - Clear refund policy in Terms.
  - Receipt email sent immediately on payment.
  - 7-day refund window prominent on pricing page.
  - Quick refund response (< 24 hours).

---

## Tier gating in code

Single source of truth: `users.tier` column. Checked server-side on every gated request.

### Helper function
```ts
function requireTier(user: User, min: 'pro' | 'elite') {
  const tiers = { free: 0, pro: 1, elite: 2 };
  if (tiers[user.tier] < tiers[min]) {
    throw new ApiError('TIER_INSUFFICIENT', 402);
  }
}
```

### Where it's used (full list)
| Feature | Min tier |
|---|---|
| Practice question (free unlimited) | pro |
| Answer explanation (free sees only correct/wrong) | pro |
| Certificate PDF download | pro |
| AI weakness detection | pro |
| AI personalized study plan | elite |
| Mock SAT tests | elite |
| Section-level predictions | elite |

### Past-due grace period
Users with `subscription_status = 'past_due'` retain access for **3 days** after the failed payment.
After 3 days, treated as free until payment resolves.

---

## Webhook security

All Stripe webhooks verify the signature using `STRIPE_WEBHOOK_SECRET`. Implementation:

```ts
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

If verification fails → `400`, log to Sentry.

### Idempotency
Stripe may deliver the same event twice. We dedupe via `stripe_events` table:
- Each event has a unique `id` (e.g., `evt_1AbCdEf...`)
- Before processing, check if `stripe_events.stripe_event_id` exists
- If yes → return `200 OK`, do nothing
- If no → process, then insert row

### Event handlers (all in `/api/stripe/webhook`)

| Event type | Action |
|---|---|
| `checkout.session.completed` | Create subscription row, update user.tier, send welcome email |
| `customer.subscription.created` | (Redundant with above, but defensive) ensure subscription row exists |
| `customer.subscription.updated` | Sync status, current_period_end, cancel_at_period_end, tier (if changed) |
| `customer.subscription.deleted` | Set tier=free, status=canceled |
| `invoice.payment_succeeded` | Update current_period_end |
| `invoice.payment_failed` | Status=past_due, email user |

---

## Failure modes

### Stripe is down
- New checkouts fail. UI shows "Payments temporarily unavailable, try again in a few minutes."
- Webhook deliveries queue at Stripe — we'll receive them when service resumes.
- Stripe has > 99.99% uptime; this is rare.

### Webhook misses an event
- Stripe retries failed deliveries for 3 days.
- If still missed: manual sync. Admin clicks "Resync subscription" on a user → server calls Stripe API to fetch current state.

### Our DB out of sync with Stripe
- Reconciliation job (cron, daily): fetch all active subscriptions from Stripe, compare against our DB.
- Alert admin if discrepancy.

### Duplicate subscription
- Should be impossible — `client_reference_id` is the user ID, and we check for existing active subscription before creating Checkout.
- Defensive: webhook handler treats "subscription already exists for user" as update, not create.

---

## Compliance considerations

- **PCI DSS:** We never touch card data. Stripe Checkout = SAQ A (lowest scope).
- **Strong Customer Authentication (SCA):** Stripe handles 3DS for EU cards.
- **VAT/sales tax:** Stripe Tax handles.
- **Refund disclosure:** in Terms + on pricing page.
- **Auto-renewal disclosure:** clearly stated on pricing page + in receipt email (EU + California requirement).

---

## Reporting & metrics

Tracked via PostHog + Stripe dashboard. Key metrics:

| Metric | Definition | Target (6 months) |
|---|---|---|
| MRR | Monthly Recurring Revenue | $2,000 |
| Paid users | Users with active subscription | 200 |
| Conversion rate | Signups → paid within 14 days | 5% |
| Churn rate | Cancellations / active subs | < 8%/month |
| LTV | Average revenue per user lifetime | $60+ |
| ARPU (paid) | MRR / paid users | $14 |

### Admin dashboard surfaces these (Phase 4)
- Top section: MRR, active subs, churn last 30d
- Cohort retention chart
- Tier distribution (Free / Pro / Elite)

---

## Future pricing experiments

- **Annual plans:** 20% off Pro/Elite annual after Phase 9.
- **Promo codes:** "FIRST50" type campaigns via Stripe coupons.
- **Bundle with Telegram course:** Pre-built bundle SKU (one-time payment for course + 3 months Pro).
- **Student discount:** verified via `.edu` email or proof, 20% off (Phase 10).
- **Regional pricing:** Lower price for Uzbekistan/CIS market (need Stripe support — feasible).

---

## What changes if we add a free trial

We're not launching with a trial, but if/when we add one:

- Trial length: 7 days, no card upfront.
- Implementation: Stripe `trial_period_days` on subscription.
- Email sequence: day 1 (onboarding), day 3 (tip), day 6 (trial ending tomorrow), day 7 (welcome to Pro / canceled).
- Trial users count as Pro for tier gating; tier downgrades on trial end if not converted.

We hold off because:
- Free tier already lets students experience the product.
- Trials with cards upfront cause refund-abuse (people forget to cancel).
- Trials without cards have low conversion.

Revisit after first 100 paid users.

---

**See next:** [11-content-pipeline.md](11-content-pipeline.md) for how questions actually get into the system.
