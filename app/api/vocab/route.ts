import { NextRequest } from 'next/server';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupVocab, normalizeWord, isAdvancedWord } from '@/lib/ai/vocab';
import { AiError } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/**
 * On-hover vocabulary lookup. A Pro/Elite member can ask for an advanced word's
 * meaning + Uzbek/Russian translation; results are cached cross-user in `vocab_cache`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  // Vocab translation is a Pro/Elite feature.
  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single();
  const tier = profile?.tier ?? 'free';
  if (tier !== 'pro' && tier !== 'elite') {
    return Response.json({ ok: false, reason: 'tier_locked' }, { status: 403 });
  }

  let body: { word?: string; context?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const display = (body.word ?? '').trim();
  const word = normalizeWord(display);
  if (!word || !isAdvancedWord(word)) {
    return Response.json({ error: 'NOT_A_WORD' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const entry = await lookupVocab(admin, display, body.context ?? null);
    return Response.json({ ok: true, entry });
  } catch (err) {
    if (err instanceof AiError) {
      console.error('[vocab] lookup failed:', err.message);
      return Response.json({ ok: false, reason: 'unavailable' });
    }
    throw err;
  }
}
