import { NextRequest } from 'next/server';
import Papa from 'papaparse';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { validateQuestion } from '@/lib/admin/question-validation';

const BATCH_SIZE = 50;

type RawRow = Record<string, string>;

type RowError = { row: number; reason: string };
type PreviewRow = {
  row: number;
  subject: string;
  category: string;
  questionText: string;
  correctAnswer: string;
  difficulty: string;
};

function dedupeKey(text: string, answer: string) {
  return `${text.trim().toLowerCase()}::${answer.trim().toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

  let payload: { csv?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!payload.csv || typeof payload.csv !== 'string') {
    return Response.json({ error: 'NO_CSV' }, { status: 400 });
  }

  const parsed = Papa.parse<RawRow>(payload.csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return Response.json(
      { error: 'PARSE_FAILED', detail: parsed.errors[0]?.message },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Build subject/category lookup (match by name or slug, case-insensitive).
  const [{ data: subjects }, { data: categories }, { data: existing }] =
    await Promise.all([
      admin.from('subjects').select('id, name, slug'),
      admin.from('categories').select('id, name, slug, subject_id'),
      admin.from('questions').select('question_text, correct_answer'),
    ]);

  const subjectByKey = new Map<string, string>();
  for (const s of subjects ?? []) {
    subjectByKey.set(s.name.toLowerCase(), s.id);
    subjectByKey.set(s.slug.toLowerCase(), s.id);
  }

  const categoryByKey = new Map<string, string>();
  for (const c of categories ?? []) {
    categoryByKey.set(`${c.subject_id}::${c.name.toLowerCase()}`, c.id);
    categoryByKey.set(`${c.subject_id}::${c.slug.toLowerCase()}`, c.id);
  }

  const existingKeys = new Set(
    (existing ?? []).map(q => dedupeKey(q.question_text, q.correct_answer))
  );

  const errors: RowError[] = [];
  const preview: PreviewRow[] = [];
  const toInsert: Array<{
    subject_id: string;
    category_id: string;
    question_text: string;
    passage: string | null;
    options: { id: string; text: string }[];
    correct_answer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    status: 'draft';
    tags: string[];
    created_by: string;
  }> = [];

  const seenInFile = new Set<string>();
  let skipCount = 0;

  parsed.data.forEach((raw, i) => {
    const rowNum = i + 1; // 1-based, header excluded
    const subjectName = (raw.subject ?? '').trim();
    const categoryName = (raw.category ?? '').trim();
    const subjectId = subjectByKey.get(subjectName.toLowerCase());

    if (!subjectId) {
      errors.push({ row: rowNum, reason: `Unknown subject "${subjectName}"` });
      return;
    }
    const categoryId = categoryByKey.get(`${subjectId}::${categoryName.toLowerCase()}`);
    if (!categoryId) {
      errors.push({
        row: rowNum,
        reason: `Unknown category "${categoryName}" for subject "${subjectName}"`,
      });
      return;
    }

    const correctAnswer = (raw.correct_answer ?? '').trim().toUpperCase();
    const difficulty = (raw.difficulty ?? '').trim().toLowerCase();
    const questionText = (raw.question_text ?? '').trim();
    const tags = (raw.tags ?? '')
      .split(';')
      .map(t => t.trim())
      .filter(Boolean);

    const input = {
      subjectId,
      categoryId,
      questionText,
      passage: (raw.passage ?? '').trim() || null,
      options: {
        A: (raw.option_a ?? '').trim(),
        B: (raw.option_b ?? '').trim(),
        C: (raw.option_c ?? '').trim(),
        D: (raw.option_d ?? '').trim(),
      },
      correctAnswer,
      explanation: (raw.explanation ?? '').trim(),
      difficulty,
      status: 'draft',
      tags,
    };

    const result = validateQuestion(input);
    if (!result.ok) {
      errors.push({ row: rowNum, reason: result.errors[0] });
      return;
    }

    // Dedupe against the DB and against earlier rows in this same file.
    const key = dedupeKey(questionText, correctAnswer);
    if (existingKeys.has(key) || seenInFile.has(key)) {
      skipCount += 1;
      errors.push({ row: rowNum, reason: 'Duplicate — skipped (already exists)' });
      return;
    }
    seenInFile.add(key);

    if (preview.length < 5) {
      preview.push({
        row: rowNum,
        subject: subjectName,
        category: categoryName,
        questionText: questionText.slice(0, 60),
        correctAnswer,
        difficulty,
      });
    }

    toInsert.push({
      subject_id: subjectId,
      category_id: categoryId,
      question_text: questionText,
      passage: input.passage,
      options: (['A', 'B', 'C', 'D'] as const).map(k => ({ id: k, text: input.options[k] })),
      correct_answer: correctAnswer,
      explanation: input.explanation,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      status: 'draft',
      tags,
      created_by: user.id,
    });
  });

  const summary = {
    totalRows: parsed.data.length,
    validCount: toInsert.length,
    skipCount,
    errorCount: errors.length,
    errors,
    preview,
  };

  if (dryRun) {
    return Response.json({ dryRun: true, ...summary });
  }

  // Real import — insert valid rows in batches.
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error } = await admin.from('questions').insert(batch);
    if (error) {
      return Response.json(
        { error: 'INSERT_FAILED', detail: error.message, importedSoFar: imported },
        { status: 500 }
      );
    }
    imported += batch.length;
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'question.import',
    targetType: 'question',
    after: { imported, skipped: skipCount, errors: errors.length },
    note: `CSV import: ${imported} drafts created`,
  });

  return Response.json({ dryRun: false, imported, ...summary });
}
