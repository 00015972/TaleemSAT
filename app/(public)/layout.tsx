import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surf)' }}
      >
        <div className="wrap flex items-center justify-between h-14">
          <Link
            href="/"
            className="font-serif font-bold text-lg"
            style={{ color: 'var(--green)' }}
          >
            Taleem SAT
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm rounded transition-colors hover:bg-surf2"
              style={{ color: 'var(--txt-soft)', border: '1px solid var(--border)' }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1.5 text-sm font-semibold rounded"
              style={{ background: 'var(--green)', color: '#fff' }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
