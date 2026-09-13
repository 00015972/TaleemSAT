import { NextRequest } from 'next/server';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { parseJsonRequest } from '@/lib/validation/request';
import { profileUpdateSchema } from '@/lib/validation/schemas';

export async function PATCH(request: NextRequest) {
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const parsed = await parseJsonRequest(request, profileUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .update({
      full_name: body.fullName || null,
      target_sat_score: body.targetSatScore,
      exam_date: body.examDate,
      marketing_opt_in: body.marketingOptIn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  if (!data) return Response.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

  return Response.json({ ok: true });
}
