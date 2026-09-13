import Link from 'next/link';
import { ArrowRight, Timer } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mock Tests · In development — Taleem SAT' };

export default function MockPage() {
  return (
    <div className="wrap py-5">
      <section
        className="mx-auto my-8 max-w-2xl rounded-l border border-border bg-surf p-6 sm:my-16 sm:p-10"
        aria-labelledby="mock-development-title"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-xl text-green">
            <Timer size={24} aria-hidden="true" />
          </span>
          <span className="rounded-full border border-border bg-surf-2 px-3 py-1 text-xs font-semibold text-txt-soft">
            In development
          </span>
        </div>
        <h1 id="mock-development-title" className="font-serif text-3xl font-bold leading-tight text-txt sm:text-4xl">
          Mock tests are in development
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
          We’re still working on mock tests. In the meantime, keep learning with
          practice questions from the question bank.
        </p>
        <Link
          href="/question-bank"
          className="mt-8 inline-flex min-h-11 items-center gap-3 rounded bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green"
        >
          Practice questions
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
