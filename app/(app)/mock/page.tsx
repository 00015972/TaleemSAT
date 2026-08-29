import { getAppProfile, getClaimsUser } from '@/lib/supabase/server';
import { MockRunner } from '@/components/mock/mock-runner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mock Test — Taleem SAT' };

export default async function MockPage() {
  const user = await getClaimsUser();
  let pro = false;
  if (user) {
    const profile = await getAppProfile();
    pro = profile?.tier === 'pro' || profile?.tier === 'elite';
  }

  return <MockRunner pro={pro} />;
}
