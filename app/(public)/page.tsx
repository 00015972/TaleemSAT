import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';

export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();
  const { count: subjectCount } = await supabase
    .from('subjects')
    .select('*', { count: 'exact', head: true });
  const { count: categoryCount } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true });

  const dbConnected = subjectCount !== null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="wrap relative z-10 max-w-2xl text-center py-24">
        {/* Brand mark */}
        <div className="inline-flex items-center gap-3 mb-12">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-serif font-bold text-xl text-bg shadow-gold"
            style={{ background: 'var(--gold)' }}
          >
            T
          </div>
          <div className="text-left">
            <div className="font-serif text-2xl font-semibold text-txt leading-none">
              Taleem SAT
            </div>
            <div className="text-xs text-muted mt-1 tracking-wide">
              by Bahromjon Jo&apos;raqulov
            </div>
          </div>
        </div>

        {/* Eyebrow */}
        <div className="eyebrow justify-center mb-6">Phase 0 · Foundation</div>

        {/* Headline */}
        <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-tight text-txt mb-6">
          The smarter way to conquer the{' '}
          <em
            className="font-serif italic"
            style={{ color: 'var(--green)' }}
          >
            Digital SAT
          </em>
          .
        </h1>

        <p className="text-lg text-muted leading-relaxed mb-12 max-w-lg mx-auto font-serif-body">
          We&apos;re building something real. Daily questions, AI analysis, and certificates
          that mean something. Launching soon.
        </p>

        {/* Stack status card */}
        <div
          className="rounded-l p-6 mx-auto max-w-md shadow-l text-left"
          style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
        >
          <div className="eyebrow mb-4">Stack Health</div>
          <ul className="space-y-3 text-sm font-mono">
            <li className="flex items-center justify-between">
              <span className="text-muted">Database</span>
              <span style={{ color: dbConnected ? 'var(--ok)' : 'var(--err)' }}>
                {dbConnected ? 'connected' : 'error'}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Subjects</span>
              <span className="text-txt">{subjectCount ?? '—'} seeded</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Categories</span>
              <span className="text-txt">{categoryCount ?? '—'} seeded</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Next.js</span>
              <span className="text-txt">16.2</span>
            </li>
          </ul>
        </div>

        {/* Theme toggle */}
        <div className="mt-12 flex items-center justify-center gap-4">
          <ThemeToggle />
          <a
            href="/api/health"
            className="text-sm text-muted hover:text-txt transition-colors underline underline-offset-4"
            style={{ textDecorationColor: 'var(--gold)' }}
          >
            /api/health
          </a>
        </div>
      </div>
    </main>
  );
}
