import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

if (process.env.B03_ALLOW_TEST_USER_MUTATIONS !== 'true') {
  throw new Error('Set B03_ALLOW_TEST_USER_MUTATIONS=true to create and remove disposable test users.');
}

const env = dotenv.parse(readFileSync('.env.local'));
const expectedUrl = 'https://hueyugiqprnsnogngcjn.supabase.co';
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, expectedUrl, 'Refusing to test an unexpected Supabase project');

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};
const service = createClient(expectedUrl, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
const createdUserIds = [];
const unexpectedAttemptIds = [];

function testIdentity(label) {
  const nonce = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return {
    email: `taleemsat-b03-${label}-${nonce}@example.com`,
    password: `B03!${randomBytes(24).toString('base64url')}`,
  };
}

async function createStudent(label) {
  const identity = testIdentity(label);
  const { data, error } = await service.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
    user_metadata: { full_name: `B03 Student ${label.toUpperCase()}` },
  });
  assert.ifError(error);
  assert.ok(data.user);
  createdUserIds.push(data.user.id);
  return { ...identity, id: data.user.id };
}

async function signIn(identity) {
  const client = createClient(expectedUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, clientOptions);
  const { error } = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  assert.ifError(error);
  return client;
}

async function cookieHeaderFor(identity) {
  const jar = new Map();
  const client = createServerClient(expectedUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) jar.set(cookie.name, cookie.value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  assert.ifError(error);
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function run() {
  const studentA = await createStudent('a');
  const studentB = await createStudent('b');
  const adminTester = await createStudent('admin');
  const clientA = await signIn(studentA);

  const adminPromotion = await service
    .from('users')
    .update({ role: 'admin' })
    .eq('id', adminTester.id)
    .select('id, role')
    .single();
  assert.ifError(adminPromotion.error);
  assert.equal(adminPromotion.data?.role, 'admin');

  const { data: profiles, error: profilesError } = await service
    .from('users')
    .select('id, full_name, role, tier, total_xp')
    .in('id', [studentA.id, studentB.id]);
  assert.ifError(profilesError);
  assert.equal(profiles?.length, 2, 'signup trigger did not create both disposable profiles');
  const originalBName = profiles.find(profile => profile.id === studentB.id)?.full_name;

  const { data: question, error: questionError } = await service
    .from('questions')
    .select('id, subject_id, question_text, correct_answer, status')
    .eq('status', 'published')
    .limit(1)
    .single();
  assert.ifError(questionError);
  assert.ok(question);

  const safeRead = await clientA
    .from('questions')
    .select('id, subject_id, question_text, options, difficulty, status')
    .eq('id', question.id)
    .single();
  assert.ifError(safeRead.error);
  assert.equal(safeRead.data?.status, 'published');

  const sensitiveRead = await clientA
    .from('questions')
    .select('id, correct_answer, accepted_answers, explanation')
    .eq('id', question.id)
    .single();
  assert.ok(sensitiveRead.error, 'student unexpectedly read grading-key columns');

  const draftRead = await clientA
    .from('questions')
    .select('id, status')
    .neq('status', 'published')
    .limit(5);
  assert.ifError(draftRead.error);
  assert.deepEqual(draftRead.data, []);

  const { data: subject, error: subjectError } = await service
    .from('subjects')
    .select('slug')
    .eq('id', question.subject_id)
    .single();
  assert.ifError(subjectError);
  const practiceRun = await clientA.rpc('get_practice_run', {
    p_scope_kind: 'subject',
    p_scope_slug: subject.slug,
    p_difficulty: null,
  });
  assert.ifError(practiceRun.error);
  const serializedRun = JSON.stringify(practiceRun.data);
  assert.equal(serializedRun.includes('correct_answer'), false);
  assert.equal(serializedRun.includes('accepted_answers'), false);
  assert.equal(serializedRun.includes('explanation'), false);

  const ownProfileRead = await clientA
    .from('users')
    .select('id, role, tier, total_xp')
    .in('id', [studentA.id, studentB.id]);
  assert.ifError(ownProfileRead.error);
  assert.deepEqual(ownProfileRead.data?.map(profile => profile.id), [studentA.id]);

  const privilegedUpdate = await clientA
    .from('users')
    .update({ role: 'admin', tier: 'elite', total_xp: 999999 })
    .eq('id', studentA.id)
    .select('id');
  assert.ok(privilegedUpdate.error, 'student unexpectedly updated privileged profile columns');

  const crossProfileUpdate = await clientA
    .from('users')
    .update({ full_name: 'UNEXPECTED CROSS-ACCOUNT UPDATE' })
    .eq('id', studentB.id)
    .select('id');
  assert.ifError(crossProfileUpdate.error);
  assert.deepEqual(crossProfileUpdate.data, []);

  const questionUpdate = await clientA
    .from('questions')
    .update({ question_text: question.question_text })
    .eq('id', question.id)
    .select('id');
  assert.ok(questionUpdate.error, 'student unexpectedly received question update privilege');

  const directAttempt = await clientA
    .from('attempts')
    .insert({
      user_id: studentA.id,
      question_id: question.id,
      selected_answer: question.correct_answer,
      is_correct: true,
      time_taken_ms: 1,
      context: 'practice',
    })
    .select('id');
  if (directAttempt.data?.length) {
    unexpectedAttemptIds.push(...directAttempt.data.map(attempt => attempt.id));
  }
  assert.ok(directAttempt.error, 'student unexpectedly inserted a self-graded attempt');

  const { data: attemptB, error: attemptBError } = await service
    .from('attempts')
    .insert({
      user_id: studentB.id,
      question_id: question.id,
      selected_answer: question.correct_answer,
      is_correct: true,
      time_taken_ms: 1,
      context: 'practice',
    })
    .select('id')
    .single();
  assert.ifError(attemptBError);

  const otherAttemptRead = await clientA
    .from('attempts')
    .select('id, user_id')
    .eq('id', attemptB.id);
  assert.ifError(otherAttemptRead.error);
  assert.deepEqual(otherAttemptRead.data, []);

  const otherProgressionRead = await clientA
    .from('progression_events')
    .select('id, user_id')
    .eq('user_id', studentB.id);
  assert.ifError(otherProgressionRead.error);
  assert.deepEqual(otherProgressionRead.data, []);

  const otherSubscriptionRead = await clientA
    .from('subscriptions')
    .select('id, user_id')
    .eq('user_id', studentB.id);
  assert.ifError(otherSubscriptionRead.error);
  assert.deepEqual(otherSubscriptionRead.data, []);

  for (const table of ['import_jobs', 'import_job_items']) {
    const stagingRead = await clientA.from(table).select('id').limit(1);
    assert.ok(stagingRead.error || stagingRead.data?.length === 0, `student read ${table}`);
  }

  const verification = await service
    .from('users')
    .select('id, full_name, role, tier, total_xp')
    .in('id', [studentA.id, studentB.id]);
  assert.ifError(verification.error);
  const verifiedA = verification.data.find(profile => profile.id === studentA.id);
  const verifiedB = verification.data.find(profile => profile.id === studentB.id);
  assert.deepEqual(
    { role: verifiedA?.role, tier: verifiedA?.tier, totalXp: verifiedA?.total_xp },
    { role: 'student', tier: 'free', totalXp: 0 }
  );
  assert.equal(verifiedB?.full_name, originalBName);

  const cookie = await cookieHeaderFor(studentA);
  const gradingResponse = await fetch('http://localhost:3013/api/practice/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      questionId: question.id,
      selectedAnswer: question.correct_answer,
      recordAttempt: false,
    }),
  });
  const gradingBody = await gradingResponse.json();
  assert.equal(gradingResponse.status, 200);
  assert.equal(gradingBody.isCorrect, true);
  assert.equal(gradingBody.correctAnswer, question.correct_answer);

  const adminCookie = await cookieHeaderFor(adminTester);
  const adminEditorResponse = await fetch(
    `http://localhost:3013/admin/questions/${question.id}/edit`,
    { headers: { Cookie: adminCookie }, redirect: 'manual' }
  );
  const adminEditorBody = await adminEditorResponse.text();
  assert.equal(adminEditorResponse.status, 200);
  assert.equal(adminEditorBody.includes('Edit question'), true);
  assert.equal(adminEditorBody.includes(question.correct_answer), true);

  return {
    safePublishedQuestionRead: true,
    gradingKeysBlocked: true,
    nonPublishedQuestionsHidden: true,
    practiceRpcSafe: true,
    crossProfileReadBlocked: true,
    privilegedProfileUpdateBlocked: true,
    crossProfileUpdateBlocked: true,
    questionUpdateBlocked: true,
    directAttemptInsertBlocked: true,
    crossAttemptReadBlocked: true,
    crossProgressionReadBlocked: true,
    crossSubscriptionReadBlocked: true,
    importStagingBlocked: true,
    serverGradingSucceeded: true,
    adminEditorLoadedProtectedAnswer: true,
  };
}

try {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (unexpectedAttemptIds.length) {
    await service.from('attempts').delete().in('id', unexpectedAttemptIds);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  if (createdUserIds.length) {
    await service.from('users').delete().in('id', createdUserIds);
  }
}
