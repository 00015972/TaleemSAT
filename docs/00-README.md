# TaleemSAT — Project Documentation

Welcome to the source-of-truth documentation for **Taleem SAT** — a modern Digital SAT preparation platform built by Mirsodiq.

This folder is the project's brain. Whenever you (or Claude) get lost, come back here.

---

## How to read these docs

Each numbered file covers a single concern. They are designed to be read independently, but cross-link where useful.

| # | File | What it covers | Read when… |
|---|---|---|---|
| 01 | [architecture.md](01-architecture.md) | System diagram, tech stack, folder layout | You need the 30,000-foot view |
| 02 | [database-schema.md](02-database-schema.md) | All tables, columns, indexes, RLS policies | You're writing queries or migrations |
| 03 | [api-reference.md](03-api-reference.md) | Every API route, request/response schema | You're building or calling endpoints |
| 04 | [feature-roadmap.md](04-feature-roadmap.md) | Phased build plan, dependencies, scope per phase | You're deciding what to build next |
| 05 | [security.md](05-security.md) | Auth, RLS, secrets, compliance, threat model | You're touching anything user-facing |
| 06 | [design-system.md](06-design-system.md) | Colors, type, spacing, components | You're building UI |
| 07 | [ux-flows.md](07-ux-flows.md) | User journeys + every screen state | You're designing a page or flow |
| 08 | [admin-panel.md](08-admin-panel.md) | Admin features, content ops, permissions | You're working on the admin side |
| 09 | [ai-features.md](09-ai-features.md) | Claude API usage, prompts, caching, costs | You're building AI features |
| 10 | [monetization-payments.md](10-monetization-payments.md) | Tiers, Stripe, subscription lifecycle | You're touching billing |
| 11 | [content-pipeline.md](11-content-pipeline.md) | Question authoring, CSV import, QA | You're adding/editing questions |
| 12 | [testing-strategy.md](12-testing-strategy.md) | Unit, integration, e2e, manual QA | You're writing tests or planning QA |
| 13 | [deployment-ops.md](13-deployment-ops.md) | Hosting, CI/CD, monitoring, runbooks | You're shipping or debugging prod |
| 14 | [analytics-emails.md](14-analytics-emails.md) | Event tracking, email flows, deliverability | You're measuring or notifying users |

---

## Project at a glance

**Product:** A Digital SAT prep platform. Students sign up, practice questions by category, answer a daily "Question of the Day," earn points + certificates, get AI-powered weakness analysis, and pay monthly for the premium tiers.

**Audience:** High-school students preparing for the SAT, primarily in Uzbekistan and the broader region, eventually international.

**Differentiation:**
- Daily ritual (QOD) builds habit
- Certificates create dopamine/status
- AI insights are personalized, not generic
- Built and taught by a real 1500-scorer
- 30% Telegram course discount for paying subscribers

**Business model:** Freemium SaaS with three tiers (Free, Pro $12/mo, Elite $25/mo). See [10-monetization-payments.md](10-monetization-payments.md).

---

## Tech stack (one-line summary)

**Next.js 15** (App Router) on **Vercel**, **Supabase** for Postgres + Auth + Storage, **Claude API (Haiku)** for AI, **Payme** (Uzbek) + **Stripe** (international) for payments, **Resend** for email. Full detail in [01-architecture.md](01-architecture.md).

---

## How decisions are recorded

When we make a significant architectural decision, we record it here as a one-line entry. The full reasoning lives in the relevant doc.

| Date | Decision | Where it lives |
|---|---|---|
| 2026-05-20 | Next.js 15 (App Router) — not 14 | [01-architecture.md](01-architecture.md) |
| 2026-05-20 | claude-haiku-4-5-20251001 as AI model (not Sonnet) | [09-ai-features.md](09-ai-features.md) |
| 2026-05-20 | Payme as primary payment (Uzbek); Stripe as fallback (international) | [10-monetization-payments.md](10-monetization-payments.md) |
| 2026-05-20 | Web app only — no mobile, no PWA at launch | [01-architecture.md](01-architecture.md) |
| 2026-05-20 | English-only at launch — no Uzbek/Russian localisation | [01-architecture.md](01-architecture.md) |
| 2026-05-20 | Certificates unverified — no public verify URL | [10-monetization-payments.md](10-monetization-payments.md) |
| 2026-05-20 | Keep `/api/` prefix in URL (standard Next.js); add `/v1/` versioning before mobile launch | [03-api-reference.md](03-api-reference.md) |
| 2026-05-11 | Use Supabase over self-hosted Postgres | [01-architecture.md](01-architecture.md) |
| 2026-05-11 | Three subscription tiers: Free / Pro $12 / Elite $25 | [10-monetization-payments.md](10-monetization-payments.md) |
| 2026-05-11 | CSV bulk import + admin CRUD for question pipeline | [11-content-pipeline.md](11-content-pipeline.md) |
| 2026-05-11 | Claude API as AI provider | [09-ai-features.md](09-ai-features.md) |
| 2026-05-11 | Design language: emerald + antique gold, Playfair + DM Sans | [06-design-system.md](06-design-system.md) |
| 2026-05-11 | English (R&W) + Math both in scope | [04-feature-roadmap.md](04-feature-roadmap.md) |

Add new entries at the top when decisions are made.

---

## Open questions / decisions pending

Things that still need a call before we hit the relevant phase. Add to this list, don't lose them.

- [ ] **Payme recurring billing** — does Payme natively support auto-renewing subscriptions, or do we implement manual renewal with reminders? (Needs integration research before Phase 7)
- [ ] **Pricing currency** — USD billed via Stripe for international; what currency label for Payme checkout? UZS with fixed conversion rate, or dynamic?
- [ ] **Telegram integration** — automated nudges (Telegram Bot API), or manual Telegram course linking only? (Mirsodiq will specify)
- [ ] **AI fallback** — if Haiku output quality is insufficient for specific use cases (score prediction), fall back to Sonnet on a per-feature basis?

**Resolved (no longer open):**

- ✅ Web app only — no mobile, no PWA at launch
- ✅ Certificates unverified — no public verify URL
- ✅ English-only at launch
- ✅ Claude Haiku as AI model
- ✅ Payme primary + Stripe international for payments
- ✅ Next.js 15 (App Router)

---

## Where things live

```
d:/TaleemSAT/
├── docs/              ← you are here
├── design/            ← landing page mockup, design references
│   └── landing.html   ← the design language source-of-truth
├── .agents/           ← Claude Code skills
└── (app/ to come)     ← Next.js app, not yet scaffolded
```

---

**Last updated:** 2026-05-11