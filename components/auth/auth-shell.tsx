import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true">
        <span className="auth-atmosphere-orbit auth-atmosphere-orbit-one" />
        <span className="auth-atmosphere-orbit auth-atmosphere-orbit-two" />
        <span className="auth-atmosphere-spark auth-atmosphere-spark-one">✦</span>
        <span className="auth-atmosphere-spark auth-atmosphere-spark-two">+</span>
      </div>

      <header className="auth-header">
        <Link href="/" className="auth-brand" aria-label="Taleem SAT home">
          <span className="auth-brand-mark">
            <Image src="/logo.jpg" alt="" width={48} height={48} priority />
          </span>
          <span className="auth-brand-copy">
            <strong>Taleem SAT</strong>
            <small>Practice with purpose</small>
          </span>
        </Link>

        <div className="auth-header-actions">
          <Link href="/" className="auth-home-link">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to home</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="auth-page-body">{children}</div>

      <footer className="auth-footer">
        <span>© 2026 Taleem SAT</span>
        <span aria-hidden="true">•</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
