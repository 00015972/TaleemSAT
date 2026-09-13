import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Mail, Send } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="wrap public-header-inner">
        <Link href="/" className="public-brand" aria-label="Taleem SAT home">
          <span className="public-brand-mark">
            <Image src="/logo.jpg" alt="" width={52} height={52} priority />
          </span>
          <span className="public-brand-copy">
            <strong>Taleem SAT</strong>
            <small>Practice with purpose</small>
          </span>
        </Link>

        <nav className="public-nav" aria-label="Public navigation">
          <Link href="/#practice">Practice</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#instructor">Instructor</Link>
          <Link href="/help">Help</Link>
        </nav>

        <div className="public-header-actions">
          <ThemeToggle />
          <Link href="/login" className="public-sign-in">
            Sign in
          </Link>
          <Link href="/signup" className="public-primary-button public-header-cta">
            Start free
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="wrap">
        <div className="public-footer-grid">
          <div className="public-footer-brand">
            <Link href="/" className="public-brand" aria-label="Taleem SAT home">
              <span className="public-brand-mark public-brand-mark-footer">
                <Image src="/logo.jpg" alt="" width={58} height={58} />
              </span>
              <span className="public-brand-copy">
                <strong>Taleem SAT</strong>
                <small>Digital SAT practice</small>
              </span>
            </Link>
            <p>
              Focused Digital SAT practice built to turn daily work into visible progress.
            </p>
          </div>

          <div className="public-footer-column">
            <h2>Explore</h2>
            <Link href="/#practice">Practice</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#instructor">Instructor</Link>
            <Link href="/signup">Create an account</Link>
          </div>

          <div className="public-footer-column">
            <h2>Support</h2>
            <Link href="/help">Help center</Link>
            <a href="mailto:mirsoduq@gmail.com">
              <Mail size={14} aria-hidden="true" /> Email
            </a>
            <a href="https://t.me/mirik_akramov" target="_blank" rel="noopener noreferrer">
              <Send size={14} aria-hidden="true" /> Telegram
            </a>
          </div>

          <div className="public-footer-column">
            <h2>Legal</h2>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>

        <div className="public-footer-bottom">
          <p>© 2026 Taleem SAT. Built in Tashkent.</p>
          <p className="public-developer-credit">
            Developed by{' '}
            <a href="https://t.me/mirik_akramov" target="_blank" rel="noopener noreferrer">
              Mirsodiq Akramov
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
