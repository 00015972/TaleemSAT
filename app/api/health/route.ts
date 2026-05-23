import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('subjects').select('id').limit(1);

    return NextResponse.json({
      ok: !error,
      db: error ? 'error' : 'connected',
      error: error?.message,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: 'error',
        error: err instanceof Error ? err.message : 'unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
