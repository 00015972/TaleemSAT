import Link from 'next/link';
import { PublicArticle } from '@/components/public/public-article';

export const metadata = {
  title: 'Terms — Taleem SAT',
  description: 'Terms for using the Taleem SAT free public beta.',
};

export default function TermsPage() {
  return (
    <PublicArticle
      eyebrow="Effective 12 September 2026"
      title="Terms for a focused beta."
      intro="These terms describe the practical rules for using Taleem SAT while the platform is free and still improving."
    >
      <section>
        <h2>Using the beta</h2>
        <p>
          Taleem SAT currently provides free Digital SAT practice and progress tools. There is no
          paid subscription or purchase required during this beta. Features may change, pause,
          or be removed as the service is tested and improved.
        </p>
      </section>

      <section>
        <h2>Age and account responsibility</h2>
        <p>
          You must be at least 13 years old to create an account. Provide accurate account
          information, protect your login credentials, and tell us promptly if you believe your
          account has been accessed without permission. You are responsible for activity through
          your account unless you have reported unauthorized access.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You may use Taleem SAT for personal educational practice. You may not:</p>
        <ul>
          <li>Scrape, bulk-download, republish, sell, or redistribute platform content.</li>
          <li>Probe for answers, bypass access controls, or interfere with grading and progress systems.</li>
          <li>Attempt to disrupt the service, introduce malicious code, or access another person&apos;s account or data.</li>
          <li>Use automated activity that creates unreasonable load or misrepresents genuine practice.</li>
        </ul>
      </section>

      <section>
        <h2>Educational content</h2>
        <p>
          Taleem SAT is an independent educational resource and is not affiliated with or endorsed
          by College Board. Practice results and analytics are learning indicators, not official
          SAT scores. We do not guarantee a particular score, admission outcome, or improvement.
          Report suspected content errors through the <Link href="/help">Help page</Link>.
        </p>
      </section>

      <section>
        <h2>Content and ownership</h2>
        <p>
          The Taleem SAT software, visual design, explanations, authored questions, and other
          original materials are protected by applicable intellectual-property rights. These
          terms give you permission to use the service for personal study; they do not transfer
          ownership or permission to redistribute its materials.
        </p>
      </section>

      <section>
        <h2>Availability and account action</h2>
        <p>
          The beta is provided on an as-available basis. We may perform maintenance, correct data,
          limit access, or suspend accounts where reasonably necessary to protect users, content,
          and the service. We may restrict or terminate access for serious or repeated violations
          of these terms.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          These terms may change as Taleem SAT develops. The effective date above will be updated
          when changes are published. Questions can be sent to{' '}
          <a href="mailto:mirsoduq@gmail.com">mirsoduq@gmail.com</a> or through the{' '}
          <Link href="/help">Help page</Link>.
        </p>
      </section>
    </PublicArticle>
  );
}
