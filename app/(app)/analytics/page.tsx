import { redirect } from 'next/navigation';
import {
  AnalyticsObservatory,
  ObservatoryEmpty,
  ObservatoryError,
  ObservatoryLocked,
} from '@/components/analytics/analytics-observatory';
import { computeAnalyticsOverview, type AnalyticsOverview } from '@/lib/analytics/overview';
import { createClient, getAppProfile, getClaimsUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Score Observatory — Taleem SAT' };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const user = await getClaimsUser();
  if (!user) redirect('/login');

  const profile = await getAppProfile();
  const tier = (profile?.tier as string | null) ?? 'free';
  const isPaid = tier === 'pro' || tier === 'elite';

  if (!isPaid) return <ObservatoryLocked />;

  let overview: AnalyticsOverview | null = null;
  try {
    overview = await computeAnalyticsOverview(supabase, user.id);
  } catch (error) {
    console.error('[analytics] overview failed', error);
  }

  if (!overview) return <ObservatoryError />;
  if (overview.total === 0) return <ObservatoryEmpty />;
  if (overview.readiness.current.value === null) return <ObservatoryEmpty stale />;

  return (
    <AnalyticsObservatory
      overview={overview}
      targetScore={(profile?.target_sat_score as number | null) ?? null}
      examDate={(profile?.exam_date as string | null) ?? null}
      referenceDate={overview.daily.at(-1)?.date ?? overview.readiness.series.at(-1)?.date ?? ''}
    />
  );
}
