import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/flow';
import { createClient, getUser } from '@/lib/supabase/server';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get(RECOVERY_COOKIE_NAME)?.value !== '1') {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired. Request a new link.' },
      { status: 403 }
    );
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired. Request a new link.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const password =
    body && typeof body === 'object' && 'password' in body
      ? (body as { password?: unknown }).password
      : null;

  if (
    typeof password !== 'string' ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return NextResponse.json(
      { error: 'Password must be between 8 and 128 characters.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(RECOVERY_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
