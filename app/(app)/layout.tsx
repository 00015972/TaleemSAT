import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, points, streak_days')
    .eq('id', user.id)
    .single();

  const name: string =
    (profile?.full_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    '';
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || (user.email?.slice(0, 2).toUpperCase() ?? '??');

  return (
    <AppShell
      user={{
        name: name || user.email || 'Student',
        email: user.email ?? '',
        initials,
        points: (profile?.points as number | null) ?? 0,
        streak: (profile?.streak_days as number | null) ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
