import { NextRequest } from 'next/server';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeAnalyticsOverview } from '@/lib/analytics/overview';
import {
  buildWeaknessSummary,
  hashSummary,
  readCachedInsight,
  computeAndStoreInsight,
  countTodayComputes,
  DAILY_COMPUTE_CAP,
} from '@/lib/ai/weakness';
import { AiError } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/** Minimum practice attempts before AI insight is meaningful. */
const MIN_ATTEMPTS = 10;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getClaimsUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tier, target_sat_score, exam_date')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier ?? 'free';
  if (tier !== 'pro' && tier !== 'elite') {
    return Response.json({ ok: false, reason: 'tier_locked' }, { status: 403 });
  }

  const overview = await computeAnalyticsOverview(supabase, user.id);

  if (overview.total < MIN_ATTEMPTS) {
    return Response.json({
      ok: false,
      reason: 'insufficient_data',
      have: overview.total,
      needed: MIN_ATTEMPTS,
    });
  }

  const summary = buildWeaknessSummary(overview, {
    target_sat_score: profile?.target_sat_score ?? null,
    exam_date: profile?.exam_date ?? null,
  });
  const promptHash = hashSummary(summary);
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';

  const admin = createAdminClient();

  // Serve from cache unless an explicit refresh was requested.
  if (!refresh) {
    const cached = await readCachedInsight(admin, user.id, promptHash);
    if (cached) {
      return Response.json({
        ok: true,
        cached: true,
        insight: cached.insight,
        generatedAt: cached.generatedAt,
      });
    }
  }

  // A fresh compute is needed — enforce the daily cost cap.
  const todayComputes = await countTodayComputes(admin, user.id);
  if (todayComputes >= DAILY_COMPUTE_CAP) {
    // Fall back to the most recent cached insight if we have one.
    const stale = await readCachedInsight(admin, user.id, promptHash);
    if (stale) {
      return Response.json({
        ok: true,
        cached: true,
        insight: stale.insight,
        generatedAt: stale.generatedAt,
      });
    }
    return Response.json({ ok: false, reason: 'rate_limited' });
  }

  try {
    const fresh = await computeAndStoreInsight(
      admin,
      user.id,
      promptHash,
      summary
    );
    return Response.json({
      ok: true,
      cached: false,
      insight: fresh.insight,
      generatedAt: fresh.generatedAt,
    });
  } catch (err) {
    if (err instanceof AiError) {
      console.error('[ai/insights] generation failed:', err.message);
      return Response.json({ ok: false, reason: 'unavailable' });
    }
    throw err;
  }
}
