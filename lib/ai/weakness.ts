import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { generateJSON, AiError } from './client';
import type { AnalyticsOverview } from '@/lib/analytics/overview';

/** Max fresh AI computes per user per UTC day (cost guard). Cache hits don't count. */
export const DAILY_COMPUTE_CAP = 15;

const SYSTEM_PROMPT = `You are an expert SAT tutor analyzing a student's practice data to give them the single most useful insight right now.

You will receive a JSON summary of their attempts. Your task:

1. Identify the ONE category that, if improved, would yield the biggest score gain.
2. Within that category, identify the specific sub-topic(s) failing them most (use the top_wrong_tags field as a hint).
3. Produce a concrete recommendation: how much time per day, for how many days, on what specifically.

Return JSON only, matching this schema:

{
  "headline": "string — max 90 chars, plain English, what's wrong",
  "weak_category": "string — exact category name from input",
  "weak_subtopics": ["string", ...],
  "reasoning": "string — 2-3 sentences, why this matters",
  "recommendation": "string — specific action, 1-2 sentences",
  "estimated_score_gain": "string — e.g., '40-60 points'",
  "urgency": "high|medium|low — based on days_until_exam"
}

Tone: warm but direct. No fluff. Don't say "great job" — be useful. Don't recommend the category they're already strongest in.

If days_until_exam is under 14, urgency is always high. Focus on triage, not optimization.
If overall_accuracy is above 0.85 and improving, mention the trend and recommend maintenance practice, not new focus.
If there is very little data, pick the weakest category you can see and keep the recommendation modest.`;

export const WeaknessSchema = z.object({
  headline: z.string().min(1).max(200),
  weak_category: z.string().min(1),
  weak_subtopics: z.array(z.string()).max(8).default([]),
  reasoning: z.string().min(1),
  recommendation: z.string().min(1),
  estimated_score_gain: z.string().min(1),
  urgency: z.enum(['high', 'medium', 'low']),
});

export type WeaknessInsight = z.infer<typeof WeaknessSchema>;

type Profile = {
  target_sat_score: number | null;
  exam_date: string | null;
};

const round2 = (n: number | null) =>
  n === null ? null : Math.round(n * 100) / 100;

/** Build the compact, PII-free JSON summary we send to the model. */
export function buildWeaknessSummary(
  overview: AnalyticsOverview,
  profile: Profile
) {
  const daysUntilExam = profile.exam_date
    ? Math.ceil(
        (new Date(profile.exam_date).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      )
    : null;

  return {
    user: {
      target_sat_score: profile.target_sat_score,
      exam_date: profile.exam_date,
      days_until_exam: daysUntilExam,
    },
    attempts_summary: {
      total: overview.total,
      overall_accuracy: round2(overview.overallAccuracy),
      by_category: overview.byCategory.map(c => ({
        category: c.category,
        subject: c.subjectSlug,
        attempts: c.attempts,
        correct: c.correct,
        accuracy: round2(c.accuracy),
        avg_time_ms: c.avgTimeMs,
        top_wrong_tags: c.topWrongTags,
      })),
      recent_trend: {
        last_7_days_accuracy: round2(overview.trend.last7Accuracy),
        previous_7_days_accuracy: round2(overview.trend.prev7Accuracy),
        direction: overview.trend.direction,
      },
    },
  };
}

export function hashSummary(summary: unknown): string {
  return createHash('sha256').update(JSON.stringify(summary)).digest('hex');
}

/** Number of fresh weakness computes this user has done since UTC midnight. */
export async function countTodayComputes(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from('ai_insights')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'weakness')
    .gte('computed_at', startOfDay.toISOString());
  return count ?? 0;
}

/** Return a non-expired cached insight matching this exact input, or null. */
export async function readCachedInsight(
  admin: SupabaseClient<Database>,
  userId: string,
  promptHash: string
): Promise<{ insight: WeaknessInsight; generatedAt: string } | null> {
  const { data } = await admin
    .from('ai_insights')
    .select('payload, computed_at')
    .eq('user_id', userId)
    .eq('kind', 'weakness')
    .eq('prompt_hash', promptHash)
    .gt('expires_at', new Date().toISOString())
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const parsed = WeaknessSchema.safeParse(data.payload);
  if (!parsed.success) return null;
  return { insight: parsed.data, generatedAt: data.computed_at };
}

/** Call the model, validate, store in cache (24h TTL), and return the insight. */
export async function computeAndStoreInsight(
  admin: SupabaseClient<Database>,
  userId: string,
  promptHash: string,
  summary: unknown
): Promise<{ insight: WeaknessInsight; generatedAt: string }> {
  const raw = await generateJSON(SYSTEM_PROMPT, JSON.stringify(summary));
  const parsed = WeaknessSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError('Insight failed schema validation');
  }

  const computedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await admin.from('ai_insights').insert({
    user_id: userId,
    kind: 'weakness',
    prompt_hash: promptHash,
    payload: parsed.data as unknown as Json,
    computed_at: computedAt,
    expires_at: expiresAt,
  });

  return { insight: parsed.data, generatedAt: computedAt };
}
