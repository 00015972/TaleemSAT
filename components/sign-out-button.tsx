'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="px-3 py-1.5 text-sm rounded transition-colors hover:bg-surf2"
      style={{ color: 'var(--txt-soft)', border: '1px solid var(--border)' }}
    >
      Sign out
    </button>
  );
}
