# 07 — UX Flows

> Complete user journeys. Every screen, every state.
> Cross-refs: [06-design-system.md](06-design-system.md) · [04-feature-roadmap.md](04-feature-roadmap.md)

---

## Personas

We design for two primary personas plus the admin.

### Persona 1: Amir, 17, ambitious
- Junior in high school, wants 1450+ on SAT.
- Studies 1–2 hours daily.
- Has tried free SAT resources, found them shallow.
- Will pay $12/mo if he sees real progress.
- **What he needs:** Habit, signal that he's improving, content depth.

### Persona 2: Madina, 16, exploring
- Sophomore, just heard about SAT.
- Curious but not committed.
- Won't pay anything until she's hooked.
- **What she needs:** A great free experience that converts her into Amir.

### Persona 3: Bahromjon (the tutor / admin)
- Has 200 questions in Word docs and Excel sheets.
- Wants a frictionless way to upload them.
- Doesn't want to think about hosting, payments, or code.
- **What he needs:** A clean admin panel where everything is 2 clicks away.

---

## Flow 1 — First-time student (Madina lands on the site)

```
Step 1: Landing page (/)
   ↓ "Get Started Free" CTA clicked
Step 2: Sign-up page (/signup)
   ↓ Form submitted
Step 3: Email verification banner shown
   ↓ Verification link clicked (separate tab)
Step 4: Dashboard (/dashboard) — "Welcome" tour
   ↓ "Try your first question" CTA
Step 5: QOD page (/qod)
   ↓ Answers, sees result
Step 6: Dashboard again — points updated
```

### Key moments and screens

#### 1.1 Landing page
- See [design/landing.html](../design/landing.html).
- Two CTAs: "Start practicing free" (primary, takes to signup) and "Meet your instructor" (secondary, scrolls to instructor section).
- Sample question card on right side is **interactive** — visitor can click options to feel the product.

#### 1.2 Sign-up page
- Fields: Full name, email, password, target SAT score (optional), exam date (optional), marketing opt-in (checked by default).
- Form validates as you type (Zod).
- Submit → Supabase Auth → email verification sent → redirect to `/dashboard`.
- **Error states:**
  - Email already registered → "Already have an account? Log in"
  - Weak password → "Use at least 8 characters"
  - Network error → toast "Couldn't sign you up. Try again?"

#### 1.3 Email verification banner
Top of every authenticated page until verified:
```
┌─────────────────────────────────────────────────────────┐
│ ✉ Please verify your email to start practicing.        │
│   [Resend email]    [Change email]                      │
└─────────────────────────────────────────────────────────┘
```
- Practice routes are blocked behind this banner.
- QOD answer is blocked.
- Settings is accessible.

#### 1.4 First-time dashboard
- Hero card: "Welcome to Taleem SAT, Madina"
- Three-step onboarding checklist:
  - [ ] Verify your email
  - [ ] Answer your first practice question
  - [ ] Try the Question of the Day
- After 3 steps complete, checklist disappears.

#### 1.5 QOD first answer
- Big featured card, "Your first daily question!"
- After submit:
  - **Correct:** Confetti animation. "+1 point earned. 24 more for your first certificate."
  - **Wrong:** Gentle reveal of correct answer. "It happens. The explanation is below — read it carefully."
- "Try a practice question" suggested next.

---

## Flow 2 — Returning daily student (Amir's morning ritual)

```
Step 1: Open /dashboard (bookmarked, or arrives from daily reminder email)
Step 2: Sees QOD widget — clicks "Answer today's question"
Step 3: QOD page → submits → +1 point or 0 points
Step 4: "Practice next" CTA → Practice page
Step 5: 10–20 questions, refreshing for new ones
Step 6: Leaves the app
```

### Dashboard widgets (returning view)
- Streak counter at top — "🔥 12-day streak"
- QOD card prominent
- Exam countdown — "47 days to your SAT"
- Recent performance — last 7 days of accuracy
- Suggested categories — AI-driven for Pro+, generic for free
- Recent activity feed

### Practice page interactions
- Refresh button next to "Next question" — gets a fresh random question without changing category
- Eliminate-option mode (toggle in toolbar) — strike out wrong answers
- Highlight mode (toggle) — highlight passage text
- Both toggles: persist per session, not per question

---

## Flow 3 — Practice question lifecycle (all states)

```
State A: Question loaded, no selection
State B: Option hover
State C: Option selected, no submit
State D: Submit clicked — loading
State E: Submitted, correct
State F: Submitted, wrong, correct option highlighted
State G: Explanation expanded
State H: "Next question" loading
```

### State A — Initial
- Card visible, options enabled, "Submit" button disabled until selection.
- Timer starts on first interaction (not on render).

### State B — Hover
- Option border turns green, light green background.

### State C — Selected
- Selected option: green border + light green bg + filled letter circle.
- Submit button enabled.
- Confidence row appears below options: Sure / Unsure / Guess (optional self-rating, for future analytics).

### State D — Loading
- Submit button shows spinner, label "Checking…"
- Options become non-interactive.

### State E — Correct
- Selected option turns success-green with checkmark.
- Confetti micro-burst (subtle — single particle wave).
- "Correct!" headline above explanation.
- "+ Next question" CTA enabled.
- If QOD context: "+1 point" overlay.

### State F — Wrong
- Selected option turns error-red with X.
- Correct option turns success-green with checkmark + glow.
- "Not quite — here's why" header.
- Explanation expanded by default.
- "+ Next question" CTA enabled.

### State G — Explanation
- Three parts:
  - **Why the right answer is right** (always shown)
  - **Why each wrong answer is wrong** (collapsible)
  - **Key rule** (always shown — the takeaway)
- Light editorial styling — Source Serif 4, gold tag for the rule.

### State H — Next question loading
- Card content fades out.
- Skeleton placeholder appears (matching card structure).
- New question fades in.

### Edge states
- **Out of questions in category:** "You've practiced every question in this category. Try another or wait for new content!" with cross-category suggestions.
- **Quota exhausted (free tier):** "Daily limit reached. Upgrade to Pro for unlimited practice." with upgrade CTA.
- **Network error mid-submit:** Toast "Couldn't save your answer. Try again?" with Retry.

---

## Flow 4 — QOD lifecycle

### Pre-answer (morning)
- Big featured card on QOD page.
- Difficulty + category visible.
- "+1 point on the line" badge.
- Points progress bar — "18 / 25 toward next certificate."

### Mid-answer
- Same as practice question (states C–D).
- No special difference except QOD framing.

### Post-correct
- "🎉 +1 point earned!" animation.
- New points total displayed.
- If hit a 25-point milestone:
  - Confetti larger
  - "You just earned your 25-point certificate!" headline
  - "View certificate" CTA → certificates page

### Post-wrong
- "Not today — but tomorrow is a fresh chance."
- Explanation shown.
- Suggested practice in that category.

### Already-answered
- Card shows the question, user's selected answer, correct answer, explanation.
- "Come back tomorrow!" with countdown to midnight.
- No retake.

---

## Flow 5 — Upgrade flow (Free → Pro)

```
Triggered by: feature attempt that requires Pro, OR explicit "Upgrade" click
Step 1: Pricing page or in-context paywall modal
Step 2: "Start Pro" → Stripe Checkout (in same tab)
Step 3: Payment → Stripe redirects back
Step 4: Success page (/settings/subscription?upgraded=true)
Step 5: Email receipt + welcome
```

### In-context paywall examples

**Free user clicks "AI insights" tab on analytics:**
```
┌──────────────────────────────────────────────────────┐
│   🔒  Personalized insights are a Pro feature.        │
│                                                       │
│   Pro members get AI-powered weakness detection and   │
│   personalized study recommendations.                  │
│                                                       │
│             [ See Pro plan — $12/mo ]                 │
└──────────────────────────────────────────────────────┘
```

**Free user hits daily quota:**
```
┌──────────────────────────────────────────────────────┐
│   You've answered today's 5 practice questions.       │
│                                                       │
│   Come back tomorrow, or unlock unlimited practice    │
│   with Pro.                                            │
│                                                       │
│   [ Upgrade — 30 day money-back ]                     │
└──────────────────────────────────────────────────────┘
```

### Pricing page
- Three tier cards, current tier highlighted.
- FAQ collapsible accordion below.
- Trust line: "Cancel anytime · Money-back in 7 days."

### Stripe Checkout
- Hosted by Stripe, branded with our logo + colors (via Stripe settings).
- Returns to `/settings/subscription?upgraded=true` on success.

### Post-payment success
- Confetti.
- "Welcome to Pro, Amir!"
- Highlight 3 features now available.
- Email receipt automatic from Stripe.
- Welcome email from us via Resend.

---

## Flow 6 — Subscription management (Pro user changes mind)

### Manage subscription
- `/settings/subscription` page
- Shows current tier, billing period end, next charge amount, payment method (last 4 digits)
- Three actions: "Change plan", "Update payment", "Cancel subscription"
- All three open Stripe Billing Portal (hosted)

### Cancellation
- In Stripe Portal: user confirms.
- We receive `customer.subscription.updated` webhook with `cancel_at_period_end = true`.
- User retains Pro access until `current_period_end`.
- Show banner in settings: "Pro access until May 28. [Resume subscription]"
- Email confirmation sent.

### Auto-downgrade
- On `customer.subscription.deleted` webhook, set `users.tier = 'free'`.
- Email: "Your Pro subscription has ended."

---

## Flow 7 — Earning a certificate

### Trigger
- User correctly answers a QOD that brings their points to a milestone (25, 50, 75, 100, 150, 200).

### Sequence
1. `POST /api/qod/answer` returns `certificate_earned: { id, tier: 25 }`.
2. UI shows a special "Certificate earned!" overlay (different from regular +1).
3. PDF generation queued (background task).
4. Email: "🏆 You earned a 25-point certificate."
5. Certificate appears on `/certificates` page within ~30s.
6. Free tier sees the certificate but cannot download — upgrade prompt.

### Certificate page (`/certificates`)
- Top: progress to next tier with bar.
- Earned section: cards with preview thumbnails + download button.
- Locked section: greyed cards for future milestones.

---

## Flow 8 — Admin sets a QOD

### Admin morning routine
1. Log in to `/admin`.
2. See top metric: "No QOD set for tomorrow" warning.
3. Click → `/admin/qod`.
4. Calendar view of past QODs + today's + future.
5. Click "Schedule for tomorrow" → opens question picker.
6. Filter by category, difficulty, search by text.
7. Select a question → confirm.
8. Done.

### Picker UX
- Search bar at top.
- Filter dropdowns: subject, category, difficulty.
- Recently-used-as-QOD questions are flagged ("Used as QOD on 2026-04-15") to avoid repetition.
- Preview the question as a student would see it.

---

## Flow 9 — Admin imports CSV

### Sequence
1. `/admin/questions` → "Import CSV" button.
2. Modal opens with:
   - Drag-and-drop area
   - "Download template" link
   - Explanation of the format
3. Drop CSV → preview first 5 rows.
4. Click "Import 187 questions" (count detected).
5. Progress bar shows import.
6. Result screen:
   - "187 imported successfully"
   - "13 skipped due to errors:" with table of errors per row
   - "Download error report" CSV link
7. Imported questions land in `status = 'draft'` by default. Admin reviews + publishes in bulk.

### Error handling
- Validation per row: required fields, valid options, valid correct_answer, valid difficulty.
- Errors don't block valid rows — partial success is allowed.
- Errors logged in DB for audit (`import_log` table — future).

---

## State catalog (what every page must handle)

Every page must handle these states. If a state is missing, the page isn't done.

| State | What it looks like |
|---|---|
| **Loading** | Skeleton matching the eventual content, never spinners-on-blank |
| **Empty** | Custom message + illustration + CTA back to a useful action |
| **Error (fetch failed)** | Friendly message + Retry button + link to support |
| **Auth required** | Redirect to /login |
| **Permission denied** | "You don't have access" + link back |
| **Tier insufficient** | Paywall card with upgrade CTA |
| **Network offline** | Toast: "You're offline. Reconnect to continue." |
| **Stale data** | Banner: "This page is out of date. Refresh?" |

---

## Error message guidelines

- Always **specific**, never "Something went wrong."
- Always **actionable** — tell the user what to try.
- Always **kind** — not the user's fault.

Examples:
- ✅ "We couldn't reach our server. Check your connection and try again."
- ❌ "Error: Failed to fetch"
- ✅ "That email is already in use. Want to log in instead?"
- ❌ "Duplicate email"

---

## Loading states

- Skeleton first: matches the layout of the eventual content.
- Spinner only for blocking actions inside buttons.
- Optimistic UI for fast feedback: select an option, submit shows the answer instantly while the API call resolves in background.

---

## Toasts

Three kinds:
- **Success** (green) — "Question added." Auto-dismiss 3s.
- **Error** (red) — "Couldn't save." Manual dismiss + Retry button.
- **Info** (gold) — "Streak saved for tomorrow." Auto-dismiss 4s.

Top-right corner. Stack vertically. Max 3 visible.

---

## Modal patterns

- One open at a time.
- Close on backdrop click + ESC key.
- Trap focus inside.
- Restore focus to trigger on close.
- Mobile: full-screen, not centered card.

---

## Mobile-specific patterns

- Sticky header collapses to icon-only nav.
- Bottom nav bar for primary actions on dashboard.
- Tap targets minimum 44×44px.
- Long text scrolls horizontally only if essential (tables); otherwise stack.

---

**See next:** [08-admin-panel.md](08-admin-panel.md) for the admin side in detail.
