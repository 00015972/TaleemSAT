import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { parseQuestionBankHtml, type ParsedQuestion } from '@/lib/import/html-questions';
import { validateHtmlItem } from '@/lib/import/html-validate';
import { topicSlugForSkill } from '@/lib/import/taxonomy';
import type { Json } from '@/lib/supabase/types';

/**
 * Upload a hand-converted HTML question-bank export and stage its questions.
 *
 * Everything here is deterministic DOM parsing — no AI model, no page
 * rendering — so the whole job runs synchronously in this request. Staging,
 * review, and promote all go through the same `import_job_items` pipeline;
 * see docs/15-html-import-schema.md for the HTML contract this route expects.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_HTML_BYTES = 20 * 1024 * 1024;
const FIGURE_UPLOAD_CONCURRENCY = 5;

const FIGURE_MIME_BY_TYPE: Record<string, { ext: string; contentType: string }> = {
  'image/png': { ext: 'png', contentType: 'image/png' },
  'image/jpeg': { ext: 'jpg', contentType: 'image/jpeg' },
  'image/webp': { ext: 'webp', contentType: 'image/webp' },
};

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'NO_FILE' }, { status: 400 });
  }
  if (file.type !== 'text/html' && !/\.html?$/i.test(file.name)) {
    return Response.json({ error: 'NOT_HTML' }, { status: 400 });
  }
  if (file.size > MAX_HTML_BYTES) {
    return Response.json({ error: 'TOO_LARGE', maxBytes: MAX_HTML_BYTES }, { status: 400 });
  }

  const html = await file.text();

  // Parse before touching the DB at all — unlike the PDF route, there's no
  // separate background handoff step to protect against a partial write, so
  // a bad file fails fast with nothing created.
  const { questions, parseErrors } = parseQuestionBankHtml(html);
  if (questions.length === 0) {
    return Response.json(
      { error: 'NO_QUESTIONS_PARSED', detail: parseErrors[0] },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from('import_jobs')
    .insert({
      type: 'extract',
      source_format: 'html',
      status: 'running',
      source_filename: file.name,
      total_count: questions.length,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return Response.json({ error: 'DB_ERROR', detail: jobError?.message }, { status: 500 });
  }

  const htmlPath = `${job.id}/${file.name}`;
  const { error: uploadError } = await admin.storage
    .from('source-html')
    .upload(htmlPath, html, { contentType: 'text/html', upsert: true });

  if (uploadError) {
    await admin
      .from('import_jobs')
      .update({ status: 'failed', error: `Upload failed: ${uploadError.message}` })
      .eq('id', job.id);
    return Response.json({ error: 'UPLOAD_FAILED', detail: uploadError.message }, { status: 500 });
  }

  await admin.from('import_jobs').update({ source_html_path: htmlPath }).eq('id', job.id);

  try {
    // Resolve the taxonomy once for the whole file.
    const { data: topicRows } = await admin
      .from('topics')
      .select('id, slug, category_id, categories(id, subject_id)');

    const topicBySlug = new Map(
      (topicRows ?? []).map(t => {
        const cat = t.categories as unknown as { id: string; subject_id: string } | null;
        return [
          t.slug,
          { topicId: t.id, categoryId: t.category_id, subjectId: cat?.subject_id ?? null },
        ];
      })
    );

    // Upload embedded figures with bounded concurrency, then build every
    // staging row in memory, so the DB only sees one batch insert instead of
    // 200+ sequential awaits inside a synchronous request.
    const rows = await mapWithConcurrency(
      questions,
      FIGURE_UPLOAD_CONCURRENCY,
      async q => buildRow(admin, job.id, q, topicBySlug)
    );

    const { error: insertError } = await admin.from('import_job_items').insert(rows);
    if (insertError) {
      await admin
        .from('import_jobs')
        .update({ status: 'failed', error: insertError.message })
        .eq('id', job.id);
      return Response.json({ error: 'DB_ERROR', detail: insertError.message }, { status: 500 });
    }

    const success = rows.filter(r => r.status === 'pending_review').length;
    const failed = rows.length - success;

    await admin
      .from('import_jobs')
      .update({
        status: 'completed',
        success_count: success,
        failed_count: failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await logAudit(admin, {
      actorUserId: user.id,
      action: 'import.start',
      targetType: 'question',
      targetId: job.id,
      after: { filename: file.name, bytes: file.size, sourceFormat: 'html', questionCount: questions.length },
      note: `Imported HTML question bank: ${file.name}`,
    });

    return Response.json({ jobId: job.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from('import_jobs')
      .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return Response.json({ error: 'PROCESSING_FAILED', detail: message }, { status: 500 });
  }
}

async function buildRow(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  q: ParsedQuestion,
  topicBySlug: Map<string, { topicId: string; categoryId: string; subjectId: string | null }>
) {
  if (q.figureDataUrls.length > 0 && !FIGURE_MIME_BY_TYPE[mimeOf(q.figureDataUrls[0])]) {
    q.structuralFlags.push(
      'Embedded figure is an unsupported image type (expected PNG/JPEG/WEBP) — could not attach it automatically.'
    );
  }

  const questionImageUrl =
    q.figureDataUrls.length > 0
      ? await uploadFigure(admin, jobId, q.sourceQid, q.figureDataUrls[0])
      : null;

  const taxonomy = q.skill ? topicBySlug.get(topicSlugForSkill(q.skill) ?? '') : undefined;
  const { status, issues, verification } = validateHtmlItem(q, taxonomy);

  return {
    job_id: jobId,
    status,
    source_ref: q.sourceQid,
    subject_id: taxonomy?.subjectId ?? null,
    category_id: taxonomy?.categoryId ?? null,
    topic_id: taxonomy?.topicId ?? null,
    question_type: q.questionType,
    question_text: q.questionText || null,
    passage: q.passage,
    options: q.options,
    correct_answer: q.correctAnswer,
    accepted_answers: q.acceptedAnswers,
    explanation: q.explanation || null,
    difficulty: q.difficulty,
    question_image_url: questionImageUrl,
    chart_svg: q.chartSvgs[0] ?? null,
    tables: q.tables,
    verification_notes: verification as unknown as Json,
    validation_errors: issues.length > 0 ? issues : null,
  };
}

function mimeOf(dataUrl: string): string {
  return dataUrl.match(/^data:([^;]+);base64,/)?.[1]?.toLowerCase() ?? '';
}

async function uploadFigure(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  sourceQid: string,
  dataUrl: string
): Promise<string | null> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mime = FIGURE_MIME_BY_TYPE[match[1].toLowerCase()];
  if (!mime) return null;

  const buffer = Buffer.from(match[2], 'base64');
  const path = `imports/${jobId}/${sourceQid}-fig0.${mime.ext}`;

  const { error } = await admin.storage
    .from('question-images')
    .upload(path, buffer, { contentType: mime.contentType, upsert: true });
  if (error) return null;

  const { data } = admin.storage.from('question-images').getPublicUrl(path);
  return data.publicUrl;
}

/** Run `fn` over `items` with at most `limit` in flight at once, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
