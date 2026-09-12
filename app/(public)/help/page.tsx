import Link from 'next/link';
import { ArrowRight, KeyRound, Mail, MessageCircle, TriangleAlert } from 'lucide-react';
import { PublicArticle } from '@/components/public/public-article';

export const metadata = {
  title: 'Help — Taleem SAT',
  description: 'Get account, practice, and technical help for Taleem SAT.',
};

export default function HelpPage() {
  return (
    <PublicArticle
      eyebrow="Help center"
      title="A clear way forward."
      intro="Whether an account link failed or a practice question looks wrong, reach the person building Taleem SAT directly."
    >
      <section className="public-help-grid" aria-label="Support channels">
        <a className="public-contact-card" href="mailto:mirsoduq@gmail.com">
          <span><Mail size={21} aria-hidden="true" /></span>
          <div><small>Email support</small><strong>mirsoduq@gmail.com</strong></div>
          <ArrowRight size={17} aria-hidden="true" />
        </a>
        <a
          className="public-contact-card"
          href="https://t.me/mirik_akramov"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span><MessageCircle size={21} aria-hidden="true" /></span>
          <div><small>Telegram support</small><strong>@mirik_akramov</strong></div>
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>

      <section>
        <h2>Account access</h2>
        <p>
          If you forgot your password, use the secure recovery flow. Never send your password,
          verification code, or recovery link through email or Telegram.
        </p>
        <div className="public-inline-actions">
          <Link href="/forgot-password"><KeyRound size={16} aria-hidden="true" /> Reset password</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Create an account</Link>
        </div>
      </section>

      <section>
        <h2>Report a question</h2>
        <div className="public-callout">
          <TriangleAlert size={21} aria-hidden="true" />
          <p>
            Include the question identifier if it is visible, the subject or category, and a
            short explanation of what seems incorrect. A screenshot is helpful, but do not
            include account credentials or private information.
          </p>
        </div>
        <a
          className="public-text-link"
          href="mailto:mirsoduq@gmail.com?subject=Taleem%20SAT%20question%20report"
        >
          Email a question report <ArrowRight size={15} aria-hidden="true" />
        </a>
      </section>

      <section>
        <h2>Before you contact support</h2>
        <ul>
          <li>Refresh the page once and check that your internet connection is stable.</li>
          <li>For a stuck practice screen, leave the session and reopen the same category.</li>
          <li>For email confirmation, check spam and wait a few minutes before requesting another email.</li>
          <li>Describe what you expected, what happened, and which page you were using.</li>
        </ul>
      </section>

      <section>
        <h2>Privacy and account requests</h2>
        <p>
          Requests to access, correct, or delete account data can be sent to the support email
          above. Read the <Link href="/privacy">Privacy notice</Link> and <Link href="/terms">Terms</Link>{' '}
          for more information.
        </p>
      </section>
    </PublicArticle>
  );
}
