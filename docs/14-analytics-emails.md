# 14 — Analytics & Emails

> What we measure, how we measure it, and every email we send.
> Cross-refs: [07-ux-flows.md](07-ux-flows.md) · [05-security.md](05-security.md)

---

## Part 1 — Analytics

### What we want to learn

Three categories of questions:

1. **Are users getting hooked?** (engagement, retention, daily habit)
2. **Are users improving?** (accuracy trends, time on task)
3. **Are users paying?** (conversion, churn, MRR)

Everything we measure ladders up to one of those.

---

### Analytics tooling

**PostHog** is our primary analytics tool. It handles:
- Event tracking
- Funnels
- Cohort retention
- Session replay (sampled)
- Feature flags
- A/B testing (Phase 10+)

**Why PostHog over alternatives:**
- Self-hosting option if needed
- Open source, transparent pricing
- Good developer ergonomics
- All the features we need in one place (no Mixpanel + Hotjar + Optimizely combo)

**Sentry** for error analytics — separate from product analytics.

---

### What we track (event taxonomy)

Names are `category.action` lowercase with underscores. **Properties** are listed below each event.

#### Authentication
- `auth.signup_started` — `{ source: 'landing'|'pricing'|... }`
- `auth.signup_completed` — `{ marketing_opt_in, has_target_score, has_exam_date }`
- `auth.signup_failed` — `{ reason }`
- `auth.email_verified`
- `auth.login` — `{ method: 'email' }`
- `auth.logout`
- `auth.password_reset_requested`

#### Onboarding
- `onboarding.first_question_attempted`
- `onboarding.first_question_correct`
- `onboarding.first_qod_answered`
- `onboarding.completed` — all 3 steps done

#### Practice
- `practice.question_loaded` — `{ category_slug, difficulty }`
- `practice.option_selected` — `{ category_slug }`
- `practice.attempt_submitted` — `{ category_slug, is_correct, time_taken_ms, difficulty }`
- `practice.explanation_viewed` — `{ category_slug, is_correct }`
- `practice.next_clicked` — `{ category_slug }`
- `practice.quota_exhausted` — `{ tier: 'free' }`

#### QOD
- `qod.viewed` — `{ already_answered }`
- `qod.attempt_submitted` — `{ is_correct, time_taken_ms }`
- `qod.points_earned` — `{ new_total, streak_days }`
- `qod.streak_extended` — `{ streak_days }`

#### Certificates
- `certificate.earned` — `{ tier: 25 }`
- `certificate.downloaded` — `{ tier }`
- `certificate.paywall_shown` — `{ tier }`

#### Subscriptions
- `subscription.upgrade_clicked` — `{ source, from_tier, to_tier }`
- `subscription.checkout_initiated` — `{ tier }`
- `subscription.checkout_completed` — `{ tier }`
- `subscription.canceled` — `{ tier, reason }` (reason from Stripe portal)
- `subscription.payment_failed`
- `subscription.payment_recovered`

#### AI
- `ai.insight_requested` — `{ kind: 'weakness'|'plan' }`
- `ai.insight_served_from_cache`
- `ai.insight_generated` — `{ tokens_in, tokens_out, latency_ms }`
- `ai.insight_failed` — `{ reason }`

#### Admin
- `admin.question_created`
- `admin.question_published`
- `admin.csv_imported` — `{ imported, skipped, errors }`
- `admin.qod_scheduled` — `{ for_date }`

#### Marketing pages
- `marketing.cta_clicked` — `{ cta: 'hero'|'pricing-free'|'pricing-pro'|... }`
- `marketing.scrolled_to` — `{ section }`

---

### How we send events

Every event is sent **client-side** via PostHog JS SDK except critical conversion events, which are also sent **server-side** for accuracy (server-side beats ad blockers).

```ts
// Client
posthog.capture('practice.attempt_submitted', {
  category_slug: 'craft-and-structure',
  is_correct: true,
  time_taken_ms: 32000,
});

// Server (mirror for important events)
posthog.capture({
  distinctId: user.id,
  event: 'subscription.checkout_completed',
  properties: { tier: 'pro' },
});
```

### User identification
- On signup: `posthog.identify(user.id, { email, tier, created_at })`
- On tier change: `posthog.people.set({ tier: newTier })`
- On logout: `posthog.reset()`

### Person properties (set once or rarely)
- `email`
- `tier`
- `role`
- `target_sat_score`
- `exam_date`
- `streak_days` (updated daily)
- `total_attempts` (updated daily)
- `overall_accuracy` (updated daily)
- `created_at`

PII (email) is sent to PostHog because it's useful for support. We treat PostHog as a data subprocessor in our privacy policy.

---

### Key funnels

Built in PostHog from the events above. We monitor:

#### Funnel 1: Acquisition → Activation
```
marketing.cta_clicked
  → auth.signup_completed
    → auth.email_verified
      → onboarding.first_question_attempted
        → onboarding.completed
```
Target: 30% of signups reach `onboarding.completed` within 24h.

#### Funnel 2: Activation → Habit
```
onboarding.completed
  → qod.attempt_submitted (day 1)
    → qod.attempt_submitted (day 3)
      → qod.attempt_submitted (day 7)
```
Target: 25% retention day 7.

#### Funnel 3: Habit → Conversion
```
qod.attempt_submitted (3+ times)
  → certificate.paywall_shown OR practice.quota_exhausted
    → subscription.upgrade_clicked
      → subscription.checkout_completed
```
Target: 5% of active users convert to paid within 14 days.

#### Funnel 4: Paid → Retention
```
subscription.checkout_completed (month 1)
  → still active (month 2)
    → still active (month 3)
```
Target: 80% retention month 1 → 2, 70% month 2 → 3.

---

### Dashboards we maintain

1. **Daily ops** — DAU, signups, QOD response rate, conversion events.
2. **Weekly retention** — cohort retention curves by signup week.
3. **Monthly business** — MRR, churn, LTV, top categories by volume.
4. **Per-category performance** — which categories are easiest, where students struggle.

Surface key numbers in `/admin/dashboard` for Bahromjon. Detail in PostHog.

---

### Privacy & analytics

- We respect Do Not Track headers (skip identification).
- IP addresses are anonymized in PostHog (last octet dropped).
- Session replays are **sampled at 5%** to limit data volume + privacy footprint.
- All PII-bearing events are documented in the privacy policy.

---

## Part 2 — Emails

### Email provider

**Resend.**

Why:
- Simple developer API
- Good deliverability out of the box
- Generous free tier (3,000/month)
- Cleaner pricing than SendGrid for our scale

Domain: `taleemsat.com` (verified with SPF + DKIM + DMARC).

**Sender names:**
- `Bahromjon from Taleem SAT <hello@taleemsat.com>` — friendly, instructor-fronted
- `Taleem SAT <noreply@taleemsat.com>` — system emails

---

### Every email we send

We're disciplined about email volume. If it's not useful, we don't send.

#### Transactional (always sent, can't opt out)

| Trigger | Subject | Goal |
|---|---|---|
| Signup | "Welcome to Taleem SAT — verify your email" | Verification + first impression |
| Password reset request | "Reset your Taleem SAT password" | Security |
| Email change | "Confirm your new email" | Security |
| Payment receipt | "Your Taleem SAT receipt for $X" | Required disclosure (Stripe sends this; we don't duplicate) |
| Subscription confirmation | "You're now a Pro member" | Welcome + setup tips |
| Subscription cancellation | "Your subscription is set to cancel" | Acknowledge action |
| Payment failed | "We couldn't process your payment" | Recovery |
| Subscription ended | "Your Pro plan has ended" | Acknowledgement + reactivation CTA |

#### Engagement (opt-in via `marketing_opt_in`, default true)

| Trigger | Subject | Cadence |
|---|---|---|
| QOD reminder | "Today's SAT question is ready" | Daily, ~10am local, only if user hasn't answered |
| Streak at risk | "Don't lose your N-day streak" | Once, ~8pm local, if streak ≥ 5 and not yet answered |
| Certificate earned | "🏆 You earned a 25-point certificate" | Triggered |
| Inactivity nudge | "Your SAT is in N days. Let's get back to it." | Once, 14 days after last activity, if exam_date is set |
| Weekly progress recap | "Your week with Taleem SAT" | Mondays, only if user practiced last week |

#### Marketing (separate opt-in, harder)

| Trigger | Subject | Cadence |
|---|---|---|
| Product announcement | "Mock SATs are now live for Elite members" | Quarterly max |
| Pricing changes | "Important: pricing update" | As needed |
| Course launch (Telegram) | "New Telegram course this Saturday" | Monthly max |

---

### Email templates

All templates live in `app/lib/email/templates/` as React components rendered with `@react-email/components`. Resend supports React components directly.

### Design rules
- Match the design system: emerald + gold, Playfair for headlines, DM Sans for body.
- Single column, max 600px wide.
- Always have an obvious unsubscribe link (legally required).
- Plain-text alternative auto-generated.

### Example template (welcome)
```tsx
// app/lib/email/templates/welcome.tsx
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

export function WelcomeEmail({ name, verifyUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ background: '#f7f5f0', fontFamily: 'DM Sans, sans-serif' }}>
        <Container style={{ maxWidth: 560, padding: 32, background: '#fff' }}>
          <Heading style={{ fontFamily: 'Playfair Display, serif', color: '#1a5c38' }}>
            Welcome to Taleem SAT, {name}.
          </Heading>
          <Text>One small step before you start practicing — verify your email.</Text>
          <Button href={verifyUrl} style={{ background: '#1a5c38', color: '#fff', padding: '12px 24px' }}>
            Verify my email
          </Button>
          <Hr />
          <Text style={{ fontSize: 12, color: '#6b6962' }}>
            You're getting this because you signed up at taleemsat.com.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### Email sending pattern

All email sends go through a single helper:

```ts
// app/lib/email/send.ts
import { Resend } from 'resend';
import { WelcomeEmail } from './templates/welcome';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  template: React.ReactElement;
  type: 'transactional' | 'engagement' | 'marketing';
  userId?: string;
}) {
  // Check user's opt-in preferences for engagement/marketing
  if (opts.type !== 'transactional' && opts.userId) {
    const user = await getUser(opts.userId);
    if (!user.marketing_opt_in) return { skipped: true };
  }
  
  const { data, error } = await resend.emails.send({
    from: opts.type === 'transactional' 
      ? 'Taleem SAT <noreply@taleemsat.com>'
      : 'Bahromjon from Taleem SAT <hello@taleemsat.com>',
    to: opts.to,
    subject: opts.subject,
    react: opts.template,
  });
  
  // Log to PostHog
  posthog.capture({
    distinctId: opts.userId ?? opts.to,
    event: 'email.sent',
    properties: { type: opts.type, subject: opts.subject },
  });
  
  return { data, error };
}
```

---

### Scheduled emails (QOD reminder, etc.)

Triggered via **Vercel Cron Jobs** (built-in in Pro plan) or **Supabase pg_cron** + edge functions.

Example cron:
```js
// app/api/cron/qod-reminder/route.ts
// Runs every hour; emails users whose local time is ~10am and haven't answered today's QOD.

export async function GET(req: Request) {
  // Verify CRON_SECRET header from Vercel
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const usersToEmail = await getUsersDueForQodReminder();
  for (const user of usersToEmail) {
    await sendEmail({
      to: user.email,
      subject: "Today's SAT question is ready",
      template: <QodReminderEmail name={user.full_name} />,
      type: 'engagement',
      userId: user.id,
    });
  }
}
```

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/qod-reminder", "schedule": "0 * * * *" },
    { "path": "/api/cron/streak-at-risk", "schedule": "0 20 * * *" },
    { "path": "/api/cron/weekly-recap", "schedule": "0 8 * * MON" }
  ]
}
```

---

### Unsubscribe handling

Every engagement/marketing email includes an unsubscribe link:
```
/api/email/unsubscribe?token=<signed_token>
```

The token is a signed JWT containing `user_id` and `category` (engagement or marketing). Clicking unsubscribes that category (not transactional — can't opt out of receipts).

Confirmation page: "You've been unsubscribed from product updates. You'll still receive transactional emails."

Users can re-subscribe from `/settings/notifications`.

---

### Deliverability

#### Domain authentication
- SPF: `v=spf1 include:_spf.resend.com ~all`
- DKIM: provided by Resend, set as TXT record
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@taleemsat.com`

#### Sender reputation
- Warm up by sending only to verified users initially.
- Avoid spam triggers: no all-caps subjects, no excessive emojis (max one per subject), avoid "FREE", "URGENT", etc.

#### Monitoring
- Resend dashboard: open rate, click rate, bounce rate, complaint rate.
- Alert if complaint rate > 0.3% (Gmail's threshold for filtering).
- Alert if bounce rate > 5%.

#### List hygiene
- Hard bounces auto-removed from sending.
- Users inactive for 90 days: skip non-critical emails to protect reputation.

---

### Email rate limits
- Per user: max 5 emails per day across all types (prevents bug-flood scenarios).
- Per IP (for password resets): standard Supabase limits.

---

### Email content rules

- **Subject lines:** 50 characters max, descriptive over clever.
- **Preview text:** customize per email (the 80-char preview shown in inbox lists).
- **Tone:** consistent with brand — direct, warm, no exclamation overuse.
- **CTAs:** one primary CTA per email. Secondary links OK.
- **Length:** transactional 100–200 words, engagement 50–150 words, marketing < 300 words.

---

### A/B testing emails (Phase 10+)

PostHog feature flags can drive email variant selection. Examples to test:
- Subject lines for QOD reminder
- Welcome email CTA copy
- Streak-at-risk timing (8pm vs 9pm)

Statistical significance: at least 500 sends per variant before deciding.

---

### Manual email broadcasts (admin tool)

Phase 10 feature: `/admin/broadcast` page where admin can:
- Compose an email
- Select audience (all users, paid users, by tier, by signup cohort)
- Preview
- Send

Until then: manual SQL query + Resend bulk API for occasional broadcasts.

---

## Summary

We measure to learn. We email to nurture. We do both with restraint.

The platform should feel like it knows what students need — not bombard them with notifications.

---

**Last in the series. Back to:** [00-README.md](00-README.md)
