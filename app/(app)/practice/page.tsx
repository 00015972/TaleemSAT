import { createClient } from '@/lib/supabase/server';
import { PracticeShell } from '@/components/practice/practice-shell';
import { computePracticeOverview, type PracticeOverview } from '@/lib/practice/overview';

export const metadata = { title: 'Practice — Taleem SAT' };

export default async function PracticePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pro = false;
  let overview: PracticeOverview = { subjects: [] };

  if (user) {
    const [{ data: profile }, computed] = await Promise.all([
      supabase.from('users').select('tier').eq('id', user.id).single(),
      computePracticeOverview(supabase, user.id),
    ]);
    pro = profile?.tier === 'pro' || profile?.tier === 'elite';
    overview = computed;
  }

  return (
    <div className="wrap py-5">
      <div className="mb-5 flex items-baseline gap-x-4 gap-y-1 flex-wrap">
        <h1 className="font-serif text-2xl font-bold text-txt">Practice</h1>
        <p className="text-sm text-muted">
          One question at a time, at your own pace.
        </p>
      </div>
      <PracticeShell overview={overview} pro={pro} />
    </div>
  );
}
