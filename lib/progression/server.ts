import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { computeProgressionSnapshot } from './dashboard';
import type { ProgressionAward, ProgressionOutcome } from './types';

export async function loadProgressionAfterAttempts(
  supabase: SupabaseClient<Database>,
  userId: string,
  attemptIds: string[]
): Promise<{ awards: ProgressionAward[]; snapshot: Awaited<ReturnType<typeof computeProgressionSnapshot>> }> {
  const uniqueIds = [...new Set(attemptIds.filter(Boolean))];
  const eventsPromise = async () => {
    if (uniqueIds.length === 0) return [];
    const { data, error } = await supabase
      .from('progression_events')
      .select('attempt_id, question_id, base_xp, correct_bonus_xp, xp_delta, streak_extended')
      .eq('user_id', userId)
      .in('attempt_id', uniqueIds);
    if (error) throw new Error(`Progression event query failed: ${error.message}`);
    return data ?? [];
  };

  const [events, snapshot] = await Promise.all([
    eventsPromise(),
    computeProgressionSnapshot(supabase, userId),
  ]);

  return {
    awards: (events ?? []).map(event => ({
      attemptId: event.attempt_id,
      questionId: event.question_id,
      baseXp: event.base_xp,
      bonusXp: event.correct_bonus_xp,
      xpAwarded: event.xp_delta,
      streakExtended: event.streak_extended,
    })),
    snapshot,
  };
}

export function progressionOutcomeForAttempt(
  attemptId: string,
  awards: ProgressionAward[],
  snapshot: Awaited<ReturnType<typeof computeProgressionSnapshot>>
): ProgressionOutcome {
  const award = awards.find(item => item.attemptId === attemptId);
  return {
    isFirstEver: Boolean(award),
    baseXp: award?.baseXp ?? 0,
    bonusXp: award?.bonusXp ?? 0,
    xpAwarded: award?.xpAwarded ?? 0,
    streakExtended: award?.streakExtended ?? false,
    snapshot,
  };
}
