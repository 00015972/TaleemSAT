import { createClient, getUser } from '@/lib/supabase/server';
import { MockRunner } from '@/components/mock/mock-runner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mock Test — Taleem SAT' };

export default async function MockPage() {
  const supabase = await createClient();
  const user = await getUser();
  let pro = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('tier')
      .eq('id', user.id)
      .single();
    pro = profile?.tier === 'pro' || profile?.tier === 'elite';
  }

  return <MockRunner pro={pro} />;
}
