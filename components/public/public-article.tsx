import Link from 'next/link';
import type { ReactNode } from 'react';

export function PublicArticle({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="public-article-page">
      <div className="public-article-glow" aria-hidden="true" />
      <article className="wrap public-article">
        <header className="public-article-header">
          <p className="landing-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="public-article-body">{children}</div>
        <div className="public-article-back">
          <Link href="/">← Back to Taleem SAT</Link>
        </div>
      </article>
    </main>
  );
}
