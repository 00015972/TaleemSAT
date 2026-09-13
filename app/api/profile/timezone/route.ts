import { NextRequest } from 'next/server';
import { isValidTimeZone } from '@/lib/progression/dates';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { parseJsonRequest } from '@/lib/validation/request';
import { timezoneUpdateSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const parsed = await parseJsonRequest(request, timezoneUpdateSchema);
  if (!parsed.ok) return parsed.response;
  if (!isValidTimeZone(parsed.data.timezone)) {
    return Response.json({ error: 'INVALID_TIMEZONE' }, { status: 400 });
  }

  const timezone = parsed.data.timezone;
  const supabase = await createClient();
  const { error } = await supabase.from('users').update({ timezone }).eq('id', user.id);
  if (error) return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });

  return Response.json({ timezone });
}
