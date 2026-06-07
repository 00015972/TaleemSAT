import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QODShell, type QOD, type QODQuestion, type PriorAnswer } from '@/components/qod/qod-shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Question of the Day — Taleem SAT' };

export default async function QODPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

   
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: schedule } = await supabase
    .from('qod_schedule')
    .select(
      `id, scheduled_date,
       questions!inner(
         id, passage, question_text, options, difficulty, tags
       )`
    )
    .eq('scheduled_date', todayStr)
    .single();

  if (!schedule) {
    return (
      <div className="wrap py-8">
        <h1 className="font-serif text-3xl font-bold text-txt mb-4">Question of the Day</h1>
        <div
          className="rounded-l p-8 text-center max-w-lg"
          style={{ background: 'var(--surf)', border: '1px dashed var(--border)' }}
        >
          <p className="text-2xl mb-3">📅</p>
          <p className="text-sm font-medium text-txt mb-1">No question scheduled for today.</p>
          <p className="text-xs text-muted">Check back tomorrow!</p>
        </div>
      </div>
    );
  }

  const { data: priorAnswer } = await supabase
    .from('qod_answers')
    .select('selected_answer, is_correct, points_awarded')
    .eq('user_id', user.id)
    .eq('qod_id', schedule.id)
    .maybeSingle();

  const rawQuestion = Array.isArray(schedule.questions)
    ? schedule.questions[0]
    : schedule.questions;

  const question = rawQuestion as unknown as QODQuestion;

  const qod: QOD = {
    id: schedule.id,
    scheduled_date: schedule.scheduled_date,
    question,
  };

  return (
    <div className="wrap py-8">
      <QODShell qod={qod} priorAnswer={(priorAnswer as PriorAnswer | null) ?? null} />
    </div>
  );
}
