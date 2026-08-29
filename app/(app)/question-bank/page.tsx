import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { PracticeShell } from '@/components/practice/practice-shell';
import { computePracticeOverview, type PracticeOverview } from '@/lib/practice/overview';

export const metadata = { title: 'Question Bank — Taleem SAT' };

export default async function QuestionBankPage() {
  const supabase = await createClient();
  const user = await getClaimsUser();

  let overview: PracticeOverview = { subjects: [] };

  if (user) {
    // Falls back to an empty tree on a DB hiccup rather than crashing the
    // page — there's no error.tsx in this app to catch an unhandled throw.
    overview = await computePracticeOverview(supabase).catch(() => ({ subjects: [] }) as PracticeOverview);
  }

  return <PracticeShell overview={overview} />;
}
