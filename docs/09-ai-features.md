# 09 — AI Features

> How we use the Claude API for weakness detection, personalized study plans, and recommendations.
> Cross-refs: [03-api-reference.md](03-api-reference.md) · [02-database-schema.md](02-database-schema.md)

---

## What AI does in this product

Three use cases, ordered by importance:

1. **Weakness detection** — analyze a user's attempt history and identify the sub-topics costing them the most points.
2. **Personalized study plan** — recommend a daily focus + time allocation based on their weaknesses, exam date, and target score.
3. **Score prediction** (Elite only) — estimate their current SAT readiness based on accuracy patterns.

What AI **does not** do (intentionally):
- ❌ Generate questions (we author all questions manually for accuracy and brand quality)
- ❌ Grade essays (no essay section in current SAT scope)
- ❌ Chat tutor / Q&A (Phase 10 maybe, not now)
- ❌ Translate or rephrase content for the user

---

## Provider choice: Claude (Anthropic)

We use `claude-haiku-4-5-20251001` for all AI features. Justification:

- More than sufficient reasoning for SAT question pattern analysis
- Excellent at following structured JSON output instructions
- Prompt caching available — keeps cost flat as attempt history grows
- ~5× cheaper than Sonnet; at our scale the savings are meaningful
- We have a relationship with Anthropic (the builder uses Claude Code)

If a specific feature proves to need deeper reasoning, we can upgrade that one call to `claude-sonnet-4-6` without changing anything else — the abstraction layer (`app/lib/ai/index.ts`) makes this a one-line change per feature.

**Fallback plan:** If Claude is unavailable, AI features show a friendly error and the rest of the product works fine. We don't gate critical paths behind AI.

---

## Model selection per task

| Task | Model | Why |
|---|---|---|
| Weakness detection (analytics page) | `claude-haiku-4-5-20251001` | Structured JSON analysis; Haiku handles this well |
| Personalized study plan (Elite) | `claude-haiku-4-5-20251001` | 14-day plan generation; deterministic output format |
| Score prediction (Elite, future) | `claude-haiku-4-5-20251001` | Upgrade to Sonnet only if output quality is insufficient |
| Daily nudge copy generation (future) | `claude-haiku-4-5-20251001` | Short text, low complexity |

All API calls use server-side SDK (`@anthropic-ai/sdk`). The API key never leaves the server.

---

## Weakness detection — full design

### Input
User's attempt history aggregated as a JSON summary:

```json
{
  "user": {
    "target_sat_score": 1450,
    "exam_date": "2026-08-24",
    "days_until_exam": 105
  },
  "attempts_summary": {
    "total": 142,
    "overall_accuracy": 0.68,
    "by_category": [
      {
        "category": "Information & Ideas",
        "subject": "english",
        "attempts": 24,
        "correct": 19,
        "accuracy": 0.79,
        "avg_time_ms": 42000
      },
      {
        "category": "Advanced Math",
        "subject": "math",
        "attempts": 22,
        "correct": 10,
        "accuracy": 0.45,
        "avg_time_ms": 78000,
        "top_wrong_tags": ["quadratic", "factoring", "exponential"]
      }
      // ... all 8 categories
    ],
    "recent_trend": {
      "last_7_days_accuracy": 0.71,
      "previous_7_days_accuracy": 0.65,
      "direction": "improving"
    }
  }
}
```

### Prompt

```
You are an expert SAT tutor analyzing a student's practice data to give them
the single most useful insight right now.

You will receive a JSON summary of their attempts. Your task:

1. Identify the ONE category that, if improved, would yield the biggest score gain.
2. Within that category, identify the specific sub-topic(s) failing them most
   (use the top_wrong_tags field as a hint).
3. Produce a concrete recommendation: how much time per day, for how many days,
   on what specifically.

Return JSON only, matching this schema:

{
  "headline": "string — max 80 chars, plain English, what's wrong",
  "weak_category": "string — exact category name from input",
  "weak_subtopics": ["string", ...],
  "reasoning": "string — 2-3 sentences, why this matters",
  "recommendation": "string — specific action, 1-2 sentences",
  "estimated_score_gain": "string — e.g., '40-60 points'",
  "urgency": "high|medium|low — based on days_until_exam"
}

Tone: warm but direct. No fluff. Don't say "great job" — be useful.
Don't recommend the category they're already strongest in.

If days_until_exam < 14, urgency is always high. Focus on triage, not optimization.
If overall_accuracy > 0.85 and improving, mention the trend and recommend
maintenance practice, not new focus.

Input:
{{ATTEMPTS_JSON}}
```

### Output (example)

```json
{
  "headline": "Advanced Math is costing you the most — specifically quadratics.",
  "weak_category": "Advanced Math",
  "weak_subtopics": ["quadratic equations", "factoring", "exponential functions"],
  "reasoning": "You're at 45% on Advanced Math but 79% on Information & Ideas. With 105 days until your exam, fixing this gap is the single highest-leverage move you can make.",
  "recommendation": "Spend 15 minutes a day on Advanced Math practice, specifically targeting quadratic equations and factoring, for the next 14 days. Then reassess.",
  "estimated_score_gain": "60-80 points",
  "urgency": "medium"
}
```

### Caching strategy

Each insight is cached in `ai_insights` table with:
- `prompt_hash` — SHA-256 of the input JSON (deduplicates identical inputs)
- `expires_at` — `computed_at + 24 hours`
- `payload` — the full JSON response

On request:
1. Compute `prompt_hash` of current attempt summary
2. Look for a row where `user_id`, `kind = 'weakness'`, `prompt_hash` matches, `expires_at > now()`
3. If found → return cached
4. If not → call Claude, store, return

**Why cache?**
- Limits Claude cost — typical user re-visits analytics multiple times per day
- Reduces latency from ~3s (API call) to ~50ms (DB read)
- Reduces noise — analysis doesn't flip every page load

**Cache invalidation:**
- Auto-expires after 24h
- Force-refreshed if user has answered >10 new questions since the cached snapshot

---

## Personalized study plan (Elite tier)

### Difference from weakness detection
- Weakness detection = "here's the one thing wrong"
- Study plan = "here's a structured 2-week plan with daily targets"

### Input
Same as weakness detection + days remaining + target score.

### Prompt outline

```
You are an SAT tutor creating a personalized 14-day study plan.

[Include attempt summary like weakness detection]

Build a 14-day plan structured as:
- Daily target: minutes total + specific category breakdown
- Two milestone reviews (Day 7, Day 14)
- A reminder of the user's exam date + target score

Return JSON:
{
  "summary": "string — what the plan does, 2 sentences",
  "days": [
    {
      "day": 1,
      "date": "2026-05-12",  // computed by server, prompt gives placeholder
      "focus_category": "string",
      "minutes": 30,
      "task": "string — concrete: 'Practice 10 Advanced Math questions, focus on quadratics'"
    },
    // ... 14 days
  ],
  "milestones": [
    { "day": 7, "checkpoint": "string" },
    { "day": 14, "checkpoint": "string" }
  ]
}

Distribute time roughly 60% on weak categories, 40% on maintenance.
Pace appropriately for days_until_exam.
```

### Output rendering
- UI shows a checklist-style 14-day plan.
- Day boxes check off as the user actually practices that day.
- "Reroll plan" button (rate-limited to 1/day) regenerates if user wants different focus.

---

## Score prediction (Elite, Phase 10+)

Hardest to do well — calibration matters. Punt to Phase 10 with manual calibration table first.

Eventual approach:
- Map per-category accuracy + difficulty mix to a scaled score (200–800 per section).
- Use Claude to interpret patterns (consistency, time-pressure performance, etc.) for a confidence interval.

For now: show "Estimated score range" using a static rubric based on accuracy buckets. No AI involved.

---

## Prompt engineering principles

We follow these rules for every prompt:

1. **Explicit structured output.** Always request JSON with a schema. We parse and validate with Zod.
2. **Constraints in the prompt.** "Max 80 chars", "don't say X", "be specific not generic" — these reduce post-processing.
3. **Examples in-prompt when it matters.** Few-shot for nuanced tone/format decisions.
4. **Role assignment first sentence.** "You are an expert SAT tutor..." — sets posture.
5. **Edge cases enumerated.** If user has < 10 attempts, < 14 days to exam, etc. — handle in prompt.
6. **No personal info in prompts.** We send aggregates, never the user's name or email. Privacy + reduces prompt drift.

---

## Cost management

### Per-call cost estimates (rough, will refine)

| Model | Input price | Output price | Typical call cost |
|---|---|---|---|
| `claude-haiku-4-5-20251001` | $0.80 / 1M tokens | $4 / 1M tokens | ~$0.001 per insight |
| `claude-sonnet-4-6` (fallback) | $3 / 1M tokens | $15 / 1M tokens | ~$0.005 per insight |

### Volume projections (rough)

At 500 daily active users, with avg 1.5 insight refreshes per active user per day:

- ~750 Haiku calls/day = ~$0.75/day = ~$22/month

Well within budget. Monitor via admin dashboard.

### Hard caps

- Per user: 10 insight requests per day (rate limit)
- Per user lifetime: 100 study-plan generations
- Global daily cap (kill switch): $50/day — emergency stop if abuse detected

### Logging
- Every Claude call logs `(user_id, model, input_tokens, output_tokens, latency_ms, cost_estimate)` to `ai_calls` table (future).
- Daily aggregate visible in admin dashboard.

### Prompt caching (Anthropic feature)

The system prompt (instructions + schema) is identical across users. We mark it as cacheable so Anthropic caches it for ~5 minutes, reducing input cost significantly.

Implementation:
```ts
const message = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" }
    }
  ],
  messages: [
    { role: "user", content: userAttemptsJson }
  ]
});
```

See `app/lib/ai/anthropic.ts` for the client wrapper.

---

## Reliability

### Timeouts
- API calls timeout at 15s.
- UI shows skeleton, then either result or error.

### Retries
- 1 retry on network error (built into SDK).
- No retries on 4xx (caller error).

### Degraded mode
- If Claude returns error or times out: show "Insight unavailable, try again later" with a refresh button.
- Don't block the analytics page from rendering basic stats.
- Sentry alerts on > 5% error rate.

### JSON validation
- Always validate Claude's response with Zod before storing or returning.
- If validation fails: log the malformed response (sans PII), return a generic error, don't cache.

---

## Privacy & ethics

- We send only aggregated practice data to Claude. Never the user's name, email, or any free-text input.
- The prompt to Claude includes target SAT score and exam date — these aren't sensitive but we treat them carefully.
- We disclose AI usage in the privacy policy.
- Users can opt out of AI features (Phase 10 — for now, AI is just gated by tier).

---

## Future ideas (Phase 10+)

- **AI tutor chat** — limited, scoped to "ask about a specific question's explanation"
- **Conversational study plan** — natural-language refinement: "Make it more aggressive"
- **AI question quality review** — flag questions whose explanation doesn't match the answer choice (admin tool)
- **Adaptive difficulty in practice** — currently random, could feed difficulty based on recent accuracy

---

## Open questions

- Should we offer a single AI provider, or build a thin abstraction so we can swap later?
  - **Decision:** Thin abstraction layer (`app/lib/ai/index.ts`) but only one implementation for now. Easy to extend if needed.
- Should AI insights be human-reviewed before being shown?
  - **Decision:** No — but the tone constraints in the prompt keep it safe. We add a feedback button ("Was this helpful?") to monitor quality.
- Multi-language insights?
  - **Decision:** Phase 10+. English-only at launch.

---

**See next:** [10-monetization-payments.md](10-monetization-payments.md) for how AI features fit into tier gating.
