import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { localDateAt, mondayWeekStart, normalizeTimeZone, shiftIsoDate } from './dates';
import { DAILY_STREAK_GOAL, type ProgressionSnapshot } from './types';

export async function computeProgressionSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date()
): Promise<ProgressionSnapshot> {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('timezone, total_xp, current_streak, longest_streak, last_streak_date')
    .eq('id', userId)
    .single();

  if (profileError) {
    throw new Error(`Progression profile query failed: ${profileError.message}`);
  }

  const timezone = normalizeTimeZone(profile?.timezone);
  const today = localDateAt(now, timezone);
  const yesterday = shiftIsoDate(today, -1);
  const weekStart = mondayWeekStart(today);

  const { data: days, error: daysError } = await supabase
    .from('daily_progress')
    .select('activity_date, qualifying_question_count, xp_earned, streak_earned')
    .eq('user_id', userId)
    .gte('activity_date', weekStart)
    .lte('activity_date', today)
    .order('activity_date', { ascending: true });

  if (daysError) {
    throw new Error(`Daily progression query failed: ${daysError.message}`);
  }

  const todayRow = (days ?? []).find(day => day.activity_date === today);
  const lastStreakDate = profile?.last_streak_date ?? null;
  const currentStreak =
    lastStreakDate && lastStreakDate >= yesterday ? (profile?.current_streak ?? 0) : 0;

  return {
    timezone,
    today: {
      activityDate: today,
      newQuestions: todayRow?.qualifying_question_count ?? 0,
      xpEarned: todayRow?.xp_earned ?? 0,
      streakEarned: todayRow?.streak_earned ?? false,
      goal: DAILY_STREAK_GOAL,
    },
    weekXp: (days ?? []).reduce((sum, day) => sum + day.xp_earned, 0),
    totalXp: profile?.total_xp ?? 0,
    currentStreak,
    longestStreak: profile?.longest_streak ?? 0,
    lastStreakDate,
  };
}
