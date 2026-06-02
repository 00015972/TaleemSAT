import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResendVerificationButton } from '@/components/resend-verification-button';

export const metadata = { title: 'Dashboard — Taleem SAT' };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, tier, points, streak_days, target_sat_score, exam_date')
    .eq('id', user.id)
    .single();

  const isVerified = !!user.email_confirmed_at;
  const rawName: string =
    (profile?.full_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    '';
  const firstName = rawName.split(' ')[0] || 'there';

  // Server Component: Date.now() runs once per request, not on re-renders
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysToExam = profile?.exam_date
    ? Math.ceil(
        (new Date(profile.exam_date as string).getTime() - nowMs) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const tier = (profile?.tier as string | null) ?? 'free';

  return (
    <div className="wrap py-8">
      {/* Email verification banner */}
      {!isVerified && (
        <div
          className="mb-6 rounded p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--txt)' }}>
            <strong>Verify your email</strong> to unlock practice questions and the Question of the Day.
          </p>
          <ResendVerificationButton email={user.email!} />
        </div>
      )}

      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-1 text-txt">
          Welcome back, {firstName}
        </h1>
        {daysToExam && daysToExam > 0 ? (
          <p className="text-sm text-muted">
            {daysToExam} day{daysToExam === 1 ? '' : 's'} until your exam. Keep going.
          </p>
        ) : (
          <p className="text-sm text-muted">Ready for today&apos;s questions?</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total points" value={profile?.points ?? 0} />
        <StatCard
          label="Day streak"
          value={profile?.streak_days ?? 0}
          suffix={profile?.streak_days === 1 ? 'day' : 'days'}
        />
        <StatCard
          label="Target score"
          value={profile?.target_sat_score ?? '—'}
        />
        <StatCard label="Plan" value={tier} capitalize />
      </div>

      {/* Onboarding checklist */}
      {!isVerified && (
        <div
          className="rounded-l p-5 mb-8"
          style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold mb-4 text-txt">Getting started</h2>
          <div className="flex flex-col gap-3">
            <ChecklistItem done={isVerified} label="Verify your email" />
            <ChecklistItem
              done={false}
              label="Answer your first practice question"
              disabled={!isVerified}
            />
            <ChecklistItem
              done={false}
              label="Try the Question of the Day"
              disabled={!isVerified}
            />
          </div>
        </div>
      )}

      {/* Coming soon placeholder */}
      <div
        className="rounded-l p-8 text-center"
        style={{ background: 'var(--surf)', border: '1px dashed var(--border)' }}
      >
        <p className="text-sm font-medium text-txt mb-1">
          Practice questions and daily QOD are coming in Phase 2.
        </p>
        <p className="text-xs text-muted">Check back soon!</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  capitalize,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  capitalize?: boolean;
}) {
  return (
    <div
      className="rounded-l p-4"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs mb-1 text-muted">{label}</p>
      <p
        className="text-xl font-bold text-txt"
        style={{ textTransform: capitalize ? 'capitalize' : undefined }}
      >
        {value}
        {suffix ? ` ${suffix}` : ''}
      </p>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  disabled,
}: {
  done: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: done ? 'var(--green)' : 'transparent',
          border: `2px solid ${done ? 'var(--green)' : 'var(--border)'}`,
        }}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1.5 4l2.5 2.5L8.5 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className="text-sm"
        style={{ color: disabled ? 'var(--muted)' : 'var(--txt)' }}
      >
        {label}
      </span>
    </div>
  );
}
