import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { getExplanation } from '@/lib/ai/explain';
import { AiError } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/** True if the user has answered this question in Practice/Mock or as a Daily Question. */
async function hasAttempted(
  admin: SupabaseClient<Database>,
  userId: string,
  questionId: string
): Promise<boolean> {
  const { count } = await admin
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('question_id', questionId);
  if (count && count > 0) return true;

  // Fall back to the Daily Question path: qod_answers → qod_schedule → question.
  const { data: scheds } = await admin
    .from('qod_schedule')
    .select('id')
    .eq('question_id', questionId);
  const schedIds = (scheds ?? []).map(s => s.id);
  if (schedIds.length === 0) return false;

  const { count: qodCount } = await admin
    .from('qod_answers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('qod_id', schedIds);
  return !!qodCount && qodCount > 0;
}

/**
 * AI "Why is this the answer?" walkthrough for a single question.
 * Gated: the caller must have already attempted this question, so we never
 * reveal answer reasoning before the student has committed to an answer.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let body: { questionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const questionId = body.questionId;
  if (!questionId) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  // AI walkthroughs are a Pro/Elite feature.
  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single();
  const tier = profile?.tier ?? 'free';
  if (tier !== 'pro' && tier !== 'elite') {
    return Response.json({ ok: false, reason: 'tier_locked' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Gate: only after the student has answered this question — via Practice/Mock
  // (an `attempts` row) or via the Daily Question (a `qod_answers` row whose
  // scheduled question matches). Never reveal reasoning before they commit.
  const attempted = await hasAttempted(admin, user.id, questionId);
  if (!attempted) {
    return Response.json({ error: 'NOT_ATTEMPTED' }, { status: 403 });
  }

  const { data: question } = await admin
    .from('questions')
    .select('id, passage, question_text, options, correct_answer, explanation, status')
    .eq('id', questionId)
    .single();

  if (!question || question.status !== 'published') {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  try {
    const explanation = await getExplanation(admin, question);
    return Response.json({ ok: true, explanation });
  } catch (err) {
    if (err instanceof AiError) {
      console.error('[explain] generation failed:', err.message);
      return Response.json({ ok: false, reason: 'unavailable' });
    }
    throw err;
  }
}
