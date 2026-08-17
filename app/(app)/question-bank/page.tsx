import { createClient } from '@/lib/supabase/server';
import { PracticeShell } from '@/components/practice/practice-shell';
import { computePracticeOverview, type PracticeOverview } from '@/lib/practice/overview';

export const metadata = { title: 'Question Bank — Taleem SAT' };

export default async function QuestionBankPage() {
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
      <PracticeShell overview={overview} pro={pro} />
    </div>
  );
}
