import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: { qodId?: string; selectedAnswer?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { qodId, selectedAnswer } = body;
  if (!qodId || !selectedAnswer) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Validate QOD exists and belongs to today
   
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: schedule } = await admin
    .from('qod_schedule')
    .select('id, scheduled_date, question_id')
    .eq('id', qodId)
    .eq('scheduled_date', todayStr)
    .single();

  if (!schedule) {
    return Response.json({ error: 'QOD_NOT_FOUND' }, { status: 404 });
  }

  // Prevent double-answering
  const { data: existing } = await admin
    .from('qod_answers')
    .select('id')
    .eq('user_id', user.id)
    .eq('qod_id', qodId)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: 'ALREADY_ANSWERED' }, { status: 409 });
  }

  // Fetch correct answer (server-side only)
  const { data: question } = await admin
    .from('questions')
    .select('correct_answer, explanation')
    .eq('id', schedule.question_id)
    .single();

  if (!question) {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const isCorrect = selectedAnswer === question.correct_answer;
  const pointsAwarded = isCorrect ? 1 : 0;

  // Record QOD answer
  const { data: qodAnswer } = await admin
    .from('qod_answers')
    .insert({
      user_id: user.id,
      qod_id: qodId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    })
    .select('id')
    .single();

  // Compute new streak
  const { data: userData } = await admin
    .from('users')
    .select('last_qod_answered_at, streak_days, points')
    .eq('id', user.id)
    .single();

   
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = 1;
  if (userData?.last_qod_answered_at) {
    const last = new Date(userData.last_qod_answered_at as string);
    last.setHours(0, 0, 0, 0);
    if (last.getTime() === yesterday.getTime()) {
      newStreak = (userData.streak_days ?? 0) + 1;
    }
  }

  const newPoints = (userData?.points ?? 0) + pointsAwarded;

  // Update user stats (always update streak + last_answered; only update points if earned)
  await admin
    .from('users')
    .update({
      last_qod_answered_at: now.toISOString(),
      streak_days: newStreak,
      ...(pointsAwarded > 0 ? { points: newPoints } : {}),
    })
    .eq('id', user.id);

  // Record in points ledger if points were earned
  if (pointsAwarded > 0 && qodAnswer) {
    await admin.from('points_ledger').insert({
      user_id: user.id,
      delta: pointsAwarded,
      reason: 'qod_correct',
      reference_id: qodAnswer.id,
    });
  }

  return Response.json({
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    pointsAwarded,
    newPoints,
    newStreak,
  });
}
