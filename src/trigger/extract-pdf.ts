import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import {
  groupPagesByQuestion,
  interpretAnswer,
  type PageText,
  type QuestionPages,
} from '../../lib/import/pdf-text';
import { topicSlugForSkill } from '../../lib/import/taxonomy';
import { transcribeQuestion } from '../../lib/ai/vision';
import { reconcile, type ItemStatus } from '../../lib/import/reconcile';

/**
 * Extract SAT questions from a College Board question-bank PDF export.
 *
 * The PDF draws every formula as vector art, so the text layer alone is not
 * enough: it gives reliable metadata (question id, domain, skill, difficulty,
 * answer key) but the prose comes back with holes where the math belongs. Each
 * question is therefore rendered to an image and transcribed by a vision model,
 * with the text layer supplied as a hint.
 *
 * Nothing here writes to `questions`. Every result lands in `import_job_items`
 * for a human to review — see the promote route for the other half.
 */

/** Render scale. 2.0 gives ~1224x1584 for US Letter, which reads cleanly. */
const RENDER_SCALE = 2.0;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const extractPdfTask = task({
  id: 'extract-pdf',
  maxDuration: 3600,
  run: async (payload: { jobId: string }) => {
    const admin = adminClient();
    const { jobId } = payload;

    const { data: job, error: jobError } = await admin
      .from('import_jobs')
      .select('id, source_pdf_path, source_filename, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Import job ${jobId} not found: ${jobError?.message}`);
    }
    if (!job.source_pdf_path) {
      throw new Error(`Import job ${jobId} has no source_pdf_path`);
    }

    await admin
      .from('import_jobs')
      .update({ status: 'running' })
      .eq('id', jobId);

    try {
      const { doc, questions } = await readQuestions(admin, job.source_pdf_path);

      await admin
        .from('import_jobs')
        .update({ total_count: questions.length })
        .eq('id', jobId);

      logger.info('Parsed PDF', { jobId, questions: questions.length });

      // Resolve the taxonomy once — every item needs subject/category/topic ids.
      const { data: topicRows } = await admin
        .from('topics')
        .select('id, slug, category_id, categories(id, subject_id)');

      const topicBySlug = new Map(
        (topicRows ?? []).map(t => {
          const cat = t.categories as unknown as {
            id: string;
            subject_id: string;
          } | null;
          return [
            t.slug,
            {
              topicId: t.id,
              categoryId: t.category_id,
              subjectId: cat?.subject_id ?? null,
            },
          ];
        })
      );

      let success = 0;
      let failed = 0;

      for (const question of questions) {
        try {
          const item = await extractOne(admin, jobId, doc, question, topicBySlug);
          if (item === 'verification_failed') failed++;
          else success++;
        } catch (err) {
          // One bad page must not sink the whole job — record it and move on.
          failed++;
          const message = err instanceof Error ? err.message : String(err);
          logger.error('Question failed', {
            questionId: question.meta.questionId,
            error: message,
          });
          await admin.from('import_job_items').insert({
            job_id: jobId,
            status: 'verification_failed',
            source_ref: `${question.meta.questionId} (p${question.pageNumbers.join(',')})`,
            difficulty: question.meta.difficulty,
            validation_errors: [`Extraction failed: ${message}`],
          });
        }

        await admin
          .from('import_jobs')
          .update({ success_count: success, failed_count: failed })
          .eq('id', jobId);
      }

      await admin
        .from('import_jobs')
        .update({
          status: 'completed',
          success_count: success,
          failed_count: failed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      logger.info('Extraction complete', { jobId, success, failed });
      return { jobId, total: questions.length, success, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from('import_jobs')
        .update({
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      throw err;
    }
  },
});

/**
 * Download the PDF and split its pages into questions. The open document comes
 * back with them — parsing and rendering both need it, and constructing one is
 * expensive enough to be worth doing exactly once per job.
 */
async function readQuestions(
  admin: ReturnType<typeof adminClient>,
  path: string
): Promise<{ doc: PdfDocument; questions: QuestionPages[] }> {
  const { data: file, error } = await admin.storage.from('source-pdfs').download(path);
  if (error || !file) {
    throw new Error(`Could not download ${path}: ${error?.message}`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await loadPdf(bytes);

  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({
      pageNumber: n,
      text: (content.items as { str: string }[]).map(i => i.str).join(''),
    });
  }

  return { doc, questions: groupPagesByQuestion(pages) };
}

type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: unknown) => { promise: Promise<void> };
  }>;
};

async function loadPdf(data: Uint8Array): Promise<PdfDocument> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return (await pdfjs.getDocument({ data, useSystemFonts: true }).promise) as PdfDocument;
}

async function renderPage(doc: PdfDocument, pageNumber: number): Promise<Buffer> {
  // Imported on demand: loading the native canvas binding costs seconds, and
  // the worker pays that on every startup if it sits at the top of the file.
  const { createCanvas } = await import('@napi-rs/canvas');

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  // PDFs assume paper: without this, transparent areas render black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toBuffer('image/png');
}

async function extractOne(
  admin: ReturnType<typeof adminClient>,
  jobId: string,
  doc: PdfDocument,
  question: QuestionPages,
  topicBySlug: Map<
    string,
    { topicId: string; categoryId: string; subjectId: string | null }
  >
): Promise<ItemStatus> {
  const { meta } = question;

  // Render every page this question spans, and keep the first as a review aid.
  const images: { base64: string; mediaType: string }[] = [];
  let pageImageUrl: string | null = null;

  for (const pageNumber of question.pageNumbers) {
    const png = await renderPage(doc, pageNumber);
    images.push({ base64: png.toString('base64'), mediaType: 'image/png' });

    if (pageImageUrl === null) {
      const path = `imports/${jobId}/${meta.questionId}-p${pageNumber}.png`;
      const { error } = await admin.storage
        .from('question-images')
        .upload(path, png, { contentType: 'image/png', upsert: true });
      if (!error) {
        const { data } = admin.storage.from('question-images').getPublicUrl(path);
        pageImageUrl = data.publicUrl;
      }
    }
  }

  const fromText = interpretAnswer(meta.correctAnswerRaw);

  const transcribed = await transcribeQuestion(images, question.text, {
    questionId: meta.questionId,
    domain: meta.domain,
    skill: meta.skill,
    difficulty: meta.difficulty,
    expectedAnswer: meta.correctAnswerRaw,
  });

  const taxonomy = meta.skill ? topicBySlug.get(topicSlugForSkill(meta.skill) ?? '') : undefined;

  const { status, issues, verification } = reconcile(meta, fromText, transcribed, taxonomy);

  const { error } = await admin.from('import_job_items').insert({
    job_id: jobId,
    status,
    source_ref: `${meta.questionId} (p${question.pageNumbers.join(',')})`,
    subject_id: taxonomy?.subjectId ?? null,
    category_id: taxonomy?.categoryId ?? null,
    topic_id: taxonomy?.topicId ?? null,
    question_type: transcribed.questionType,
    question_text: transcribed.questionText || null,
    passage: transcribed.passage,
    options: transcribed.options,
    correct_answer: transcribed.correctAnswer,
    accepted_answers: transcribed.acceptedAnswers,
    explanation: transcribed.explanation || null,
    difficulty: meta.difficulty,
    page_image_url: pageImageUrl,
    verification_notes: verification,
    validation_errors: issues.length > 0 ? issues : null,
  });

  if (error) throw new Error(`Insert failed: ${error.message}`);
  return status;
}
