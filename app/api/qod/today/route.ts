import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Today's date in server timezone (UTC)
   
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fetch today's scheduled QOD with its question
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
    return Response.json({ error: 'NO_QOD' }, { status: 404 });
  }

  // Check if user already answered today's QOD
  const { data: existingAnswer } = await supabase
    .from('qod_answers')
    .select('selected_answer, is_correct, points_awarded')
    .eq('user_id', user.id)
    .eq('qod_id', schedule.id)
    .maybeSingle();

  const question = Array.isArray(schedule.questions)
    ? schedule.questions[0]
    : schedule.questions;

  return Response.json({
    qod: {
      id: schedule.id,
      scheduled_date: schedule.scheduled_date,
      question,
    },
    answered: existingAnswer ?? null,
  });
}
