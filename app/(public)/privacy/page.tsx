import Link from 'next/link';
import { PublicArticle } from '@/components/public/public-article';

export const metadata = {
  title: 'Privacy — Taleem SAT',
  description: 'How Taleem SAT handles account, profile, and practice data during the public beta.',
};

export default function PrivacyPage() {
  return (
    <PublicArticle
      eyebrow="Effective 12 September 2026"
      title="Privacy, in plain language."
      intro="This notice explains what Taleem SAT collects during the free beta, why it is needed, and how to ask about your information."
    >
      <section>
        <h2>Information we collect</h2>
        <p>When you create and use an account, Taleem SAT may store:</p>
        <ul>
          <li>Your name, email address, account identifier, and authentication status.</li>
          <li>Profile choices such as your target SAT score, exam date, and timezone.</li>
          <li>Practice activity, including responses, correctness, timing, attempts, category progress, streaks, and XP.</li>
          <li>Technical information needed to secure and operate the service, such as session data and error or request logs.</li>
          <li>Basic product analytics, such as page visits, when analytics is enabled.</li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use this information to:</p>
        <ul>
          <li>Create and secure your account.</li>
          <li>Record practice results and show your learning progress.</li>
          <li>Maintain streaks, XP, missions, and other requested product features.</li>
          <li>Diagnose errors, prevent abuse, and improve the beta experience.</li>
          <li>Respond when you ask for help or report a content problem.</li>
        </ul>
        <p>We do not currently sell access, and we do not sell your personal information.</p>
      </section>

      <section>
        <h2>Services that help us run Taleem SAT</h2>
        <p>
          Taleem SAT uses Supabase for authentication and application data. PostHog may process
          limited product-usage events when analytics is configured. Infrastructure providers
          may process technical data needed to deliver the site. These providers operate under
          their own privacy and security terms.
        </p>
      </section>

      <section>
        <h2>Cookies and sessions</h2>
        <p>
          Essential browser storage and cookies keep you signed in, remember your theme, and
          protect account flows. Analytics storage may be used when product analytics is
          enabled. Blocking essential storage can prevent account features from working.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          We retain account and practice information while it is needed to provide the service,
          maintain legitimate records, resolve problems, and protect the platform. We use
          reasonable technical and organizational safeguards, but no online service can promise
          absolute security.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can ask to access, correct, or delete your account information by emailing{' '}
          <a href="mailto:mirsoduq@gmail.com">mirsoduq@gmail.com</a>. We may need to verify that
          the account belongs to you before completing a request. Some records may be retained
          where reasonably needed for security, dispute resolution, or legal obligations.
        </p>
      </section>

      <section>
        <h2>Students under 13</h2>
        <p>
          Taleem SAT is intended for people aged 13 or older. Do not create an account if you are
          under 13. If you believe a younger child has provided information, contact us so we can
          review and address it.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this notice as the beta changes. The effective date at the top will be
          updated when the notice changes. Questions and data requests can be sent to{' '}
          <a href="mailto:mirsoduq@gmail.com">mirsoduq@gmail.com</a> or through the{' '}
          <Link href="/help">Help page</Link>.
        </p>
      </section>
    </PublicArticle>
  );
}
