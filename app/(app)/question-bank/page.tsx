import { createClient, getAppProfile, getClaimsUser } from '@/lib/supabase/server';
import { PracticeShell } from '@/components/practice/practice-shell';
import { computePracticeOverview, type PracticeOverview } from '@/lib/practice/overview';

export const metadata = { title: 'Question Bank — Taleem SAT' };

export default async function QuestionBankPage() {
  const supabase = await createClient();
  const user = await getClaimsUser();

  let pro = false;
  let overview: PracticeOverview = { subjects: [] };

  if (user) {
    const [profile, computed] = await Promise.all([
      getAppProfile(),
      // Falls back to an empty tree on a DB hiccup rather than crashing the
      // page — there's no error.tsx in this app to catch an unhandled throw.
      computePracticeOverview(supabase).catch(() => ({ subjects: [] }) as PracticeOverview),
    ]);
    pro = profile?.tier === 'pro' || profile?.tier === 'elite';
    overview = computed;
  }

  return <PracticeShell overview={overview} pro={pro} />;
}
