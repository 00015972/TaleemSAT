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
      <div className="wrap py-5">
        <div className="app-head">
          <h1>Daily Question</h1>
          <p>One question, every day.</p>
        </div>
        <div className="prx-empty max-w-lg">
          <div className="prx-idle-bubs" aria-hidden="true">
            {['A', 'B', 'C', 'D'].map(l => (
              <span key={l} className="prx-idle-bub">{l}</span>
            ))}
          </div>
          <p className="prx-empty-title">Nothing scheduled today.</p>
          <p className="prx-empty-sub mb-4">Check back tomorrow — or keep sharp meanwhile.</p>
          <a href="/practice" className="prx-btn alt inline-block">
            Practice instead →
          </a>
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
    <div className="wrap py-5">
      <div className="app-head">
        <h1>Daily Question</h1>
        <p>One question, every day. Protect the streak.</p>
      </div>
      <QODShell qod={qod} priorAnswer={(priorAnswer as PriorAnswer | null) ?? null} />
    </div>
  );
}
