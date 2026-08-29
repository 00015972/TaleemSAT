import { redirect } from 'next/navigation';
import { getAppProfile, getClaimsUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getClaimsUser(), getAppProfile()]);

  if (!user) {
    redirect('/login');
  }

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
      }}
    >
      {children}
    </AppShell>
  );
}
