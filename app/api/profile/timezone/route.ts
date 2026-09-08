import { NextRequest } from 'next/server';
import { isValidTimeZone } from '@/lib/progression/dates';
import { createClient, getClaimsUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const [supabase, user] = await Promise.all([createClient(), getClaimsUser()]);
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let body: { timezone?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) {
    return Response.json({ error: 'INVALID_TIMEZONE' }, { status: 400 });
  }

  const timezone = body.timezone.trim();
  const { error } = await supabase.from('users').update({ timezone }).eq('id', user.id);
  if (error) return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });

  return Response.json({ timezone });
}
