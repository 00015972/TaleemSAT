import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronRight,
  Flame,
  Sparkles,
} from 'lucide-react';
import bahromjonPortrait from '../../design/bahromjon.jpg';
import {
  AccuracyArt,
  BlueprintArt,
  HeroAnswerSheet,
  MomentumArt,
} from '@/components/public/landing-art';
import { PublicReveal } from '@/components/public/public-reveal';
import {
  SkillIllustration,
  type SkillArtKind,
} from '@/components/public/landing-skill-art';
import {
  DirectionStepArt,
  PracticeStepArt,
  ProgressStepArt,
} from '@/components/public/landing-step-art';

export const metadata = {
  title: 'Taleem SAT — Free Digital SAT Practice',
  description:
    'Practice every Digital SAT skill, track your accuracy, and build consistent study momentum with Taleem SAT. Free during beta.',
};

const focusAreas: { title: string; kind: SkillArtKind }[] = [
  { title: 'Information & Ideas', kind: 'information' },
  { title: 'Craft & Structure', kind: 'craft' },
  { title: 'Expression of Ideas', kind: 'expression' },
  { title: 'English Conventions', kind: 'conventions' },
  { title: 'Algebra', kind: 'algebra' },
  { title: 'Advanced Math', kind: 'advanced' },
  { title: 'Problem-Solving & Data', kind: 'data' },
  { title: 'Geometry & Trigonometry', kind: 'geometry' },
];

const credentials = [
  { value: '1500', label: 'Personal SAT score' },
  { value: '8.0 ×2', label: 'IELTS score' },
  { value: '200+', label: 'Students taught' },
  { value: '3 years', label: 'Teaching experience' },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-grid-paper" aria-hidden="true" />
        <div className="wrap landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow landing-hero-enter landing-delay-one">
              Free public beta · No payment required
            </p>
            <h1 className="landing-hero-enter landing-delay-two">
              Turn every answer into a <em>stronger score.</em>
            </h1>
            <p className="landing-hero-lead landing-hero-enter landing-delay-three">
              Practice the exact skills the Digital SAT tests, see where your accuracy is
              moving, and build the daily rhythm that makes test day feel familiar.
            </p>
            <div className="landing-hero-actions landing-hero-enter landing-delay-four">
              <Link href="/signup" className="public-primary-button public-button-large">
                Start practicing free
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/login" className="public-secondary-button public-button-large">
                I have an account
              </Link>
            </div>
            <div className="landing-hero-trust landing-hero-enter landing-delay-five">
              <span className="landing-trust-seal"><Check size={15} aria-hidden="true" /></span>
              <p><strong>Focused from the first question.</strong><br />Choose a skill and begin in minutes.</p>
            </div>
          </div>
          <div className="landing-hero-enter landing-delay-three">
            <HeroAnswerSheet />
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Beta highlights">
        <div className="wrap landing-proof-grid">
          <div><strong>8</strong><span>Digital SAT focus areas</span></div>
          <div><strong>Free</strong><span>Throughout the public beta</span></div>
          <div><strong>Yours</strong><span>Accuracy, streaks, and XP</span></div>
        </div>
      </section>

      <section className="landing-section landing-practice" id="practice">
        <div className="wrap">
          <PublicReveal className="landing-section-heading landing-section-heading-split">
            <div>
              <p className="landing-eyebrow">Practice by the blueprint</p>
              <h2>Every SAT skill gets its own <em>workbench.</em></h2>
            </div>
            <p>
              Move between Reading and Writing or Math, choose one tested domain, and keep
              your session focused enough to learn from the pattern.
            </p>
          </PublicReveal>

          <div className="landing-focus-grid">
            {focusAreas.map((area, index) => (
              <PublicReveal key={area.title} delay={(index % 4) * 70}>
                <Link
                  href="/signup"
                  className={`landing-focus-card ${index >= 4 ? 'is-math' : ''}`}
                >
                  <span className="landing-focus-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="landing-focus-art"><SkillIllustration kind={area.kind} /></span>
                  <strong>{area.title}</strong>
                  <ChevronRight className="landing-focus-arrow" size={16} aria-hidden="true" />
                </Link>
              </PublicReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-live">
        <div className="wrap">
          <PublicReveal className="landing-section-heading">
            <p className="landing-eyebrow">Available today</p>
            <h2>Less guessing about progress.<br /><em>More proof of it.</em></h2>
            <p>
              Taleem SAT turns practice activity into a clearer picture of what you have done
              and where to focus next.
            </p>
          </PublicReveal>

          <div className="landing-bento">
            <PublicReveal className="landing-bento-card landing-bento-blueprint">
              <div className="landing-bento-copy">
                <span className="landing-feature-icon"><BookOpenCheck size={19} aria-hidden="true" /></span>
                <p className="landing-card-kicker">Category practice</p>
                <h3>Work one tested skill at a time.</h3>
                <p>Pick from all eight Digital SAT domains and answer in a focused practice session.</p>
              </div>
              <BlueprintArt />
            </PublicReveal>

            <PublicReveal className="landing-bento-card landing-bento-accuracy" delay={90}>
              <div className="landing-bento-copy">
                <span className="landing-feature-icon"><BarChart3 size={19} aria-hidden="true" /></span>
                <p className="landing-card-kicker">Accuracy analytics</p>
                <h3>See the pattern behind every attempt.</h3>
                <p>Review overall, subject, category, and recent accuracy as your history grows.</p>
              </div>
              <AccuracyArt />
            </PublicReveal>

            <PublicReveal className="landing-bento-card landing-bento-momentum" delay={180}>
              <div className="landing-bento-copy">
                <span className="landing-feature-icon"><Flame size={19} aria-hidden="true" /></span>
                <p className="landing-card-kicker">Daily momentum</p>
                <h3>Give consistency something you can see.</h3>
                <p>Complete daily missions, extend your streak, and collect XP for new work.</p>
              </div>
              <MomentumArt />
            </PublicReveal>
          </div>
        </div>
      </section>

      <section className="landing-section landing-instructor" id="instructor">
        <div className="wrap landing-instructor-grid">
          <PublicReveal className="landing-portrait-wrap">
            <div className="landing-portrait-frame">
              <Image
                src={bahromjonPortrait}
                alt="Bahromjon Jo'raqulov, SAT instructor"
                sizes="(max-width: 860px) 90vw, 42vw"
                placeholder="blur"
              />
            </div>
            <span className="landing-portrait-rule landing-portrait-rule-one" aria-hidden="true" />
            <span className="landing-portrait-rule landing-portrait-rule-two" aria-hidden="true" />
            <blockquote>
              “I teach the test I conquered—with the moves I wish I had known sooner.”
            </blockquote>
          </PublicReveal>

          <PublicReveal className="landing-instructor-copy" delay={100}>
            <p className="landing-eyebrow">Meet your instructor</p>
            <h2>Bahromjon<br />Jo&apos;raqulov</h2>
            <p className="landing-instructor-role">SAT instructor · Westminster International University</p>
            <p className="landing-instructor-bio">
              Bahromjon brings three years of focused preparation experience and a
              perfectionist&apos;s curiosity for the test itself. Every wrong answer is treated as
              a pattern worth understanding—not a number to hide.
            </p>
            <div className="landing-credentials">
              {credentials.map(item => (
                <div key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </PublicReveal>
        </div>
      </section>

      <section className="landing-section landing-steps" id="how-it-works">
        <div className="wrap">
          <PublicReveal className="landing-section-heading landing-section-heading-center">
            <p className="landing-eyebrow">Your first session</p>
            <h2>Three steps. <em>No detour.</em></h2>
            <p>Go from a blank account to useful practice in a few focused minutes.</p>
          </PublicReveal>
          <ol className="landing-step-grid">
            <PublicReveal className="landing-step" delay={0}>
              <li>
                <span className="landing-step-number">01</span>
                <DirectionStepArt />
                <div className="landing-step-copy">
                  <h3>Set your direction</h3>
                  <p>Create a free account and add your target score and exam date.</p>
                </div>
              </li>
            </PublicReveal>
            <PublicReveal className="landing-step" delay={90}>
              <li>
                <span className="landing-step-number">02</span>
                <PracticeStepArt />
                <div className="landing-step-copy">
                  <h3>Choose one skill</h3>
                  <p>Open the question bank and begin with the domain that matters today.</p>
                </div>
              </li>
            </PublicReveal>
            <PublicReveal className="landing-step" delay={180}>
              <li>
                <span className="landing-step-number">03</span>
                <ProgressStepArt />
                <div className="landing-step-copy">
                  <h3>Make growth visible</h3>
                  <p>Return to your dashboard to see accuracy, missions, streaks, and XP.</p>
                </div>
              </li>
            </PublicReveal>
          </ol>
        </div>
      </section>

      <section className="landing-beta-note">
        <div className="wrap">
          <PublicReveal className="landing-beta-note-inner">
            <span className="landing-beta-badge"><Sparkles size={15} aria-hidden="true" /> Public beta</span>
            <div>
              <h2>Practice is open. Payment is not part of the experience.</h2>
              <p>
                Taleem SAT is free during beta. Purchases and full timed mock tests are not
                currently offered, so you will not hit a checkout or a paid-feature dead end.
              </p>
            </div>
          </PublicReveal>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-ring landing-final-ring-one" aria-hidden="true" />
        <div className="landing-final-ring landing-final-ring-two" aria-hidden="true" />
        <div className="wrap landing-final-cta-inner">
          <PublicReveal>
            <p className="landing-eyebrow">Your next answer</p>
            <h2>Start where you are.<br /><em>Build from there.</em></h2>
            <p>Eight focus areas, honest progress, and no payment required during beta.</p>
            <div className="landing-final-actions">
              <Link href="/signup" className="public-primary-button public-button-large public-button-gold">
                Create my free account
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/login" className="landing-final-login">Sign in instead</Link>
            </div>
          </PublicReveal>
        </div>
      </section>
    </main>
  );
}
