import { redirect } from 'next/navigation';
import { getAppProfile, getClaimsUser, getStoredTimezone } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { TimezoneSync } from '@/components/progression/timezone-sync';
import { FALLBACK_TIMEZONE } from '@/lib/progression/dates';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, profile, storedTimezone] = await Promise.all([
    getClaimsUser(),
    getAppProfile(),
    getStoredTimezone(),
  ]);

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
  const currentStreak = Math.max(0, profile?.current_streak ?? 0);
  const totalXp = Math.max(0, profile?.total_xp ?? 0);

  return (
    <AppShell
      user={{
        name: name || user.email || 'Student',
        email: user.email ?? '',
        initials,
        currentStreak,
        totalXp,
      }}
    >
      <TimezoneSync
        savedTimeZone={storedTimezone ?? FALLBACK_TIMEZONE}
      />
      {children}
    </AppShell>
  );
}
