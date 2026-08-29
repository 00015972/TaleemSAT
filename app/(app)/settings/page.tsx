import { redirect } from 'next/navigation';
import { getAppProfile, getClaimsUser } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/settings-form';

export const metadata = { title: 'Settings — Taleem SAT' };

export default async function SettingsPage() {
  const user = await getClaimsUser();

  if (!user) redirect('/login');

  const profile = await getAppProfile();

  const tier = (profile?.tier as string | null) ?? 'free';
  const targetScore = profile?.target_sat_score
    ? String(profile.target_sat_score)
    : '';

  return (
    <SettingsForm
      userId={user.id}
      email={user.email!}
      tier={tier}
      requestDate={new Date().toISOString().slice(0, 10)}
      initial={{
        fullName: (profile?.full_name as string | null) ?? '',
        targetScore,
        examDate: (profile?.exam_date as string | null) ?? '',
        marketingOptIn: (profile?.marketing_opt_in as boolean | null) ?? true,
      }}
    />
  );
}
