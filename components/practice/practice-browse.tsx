'use client';

import { useMemo, useState } from 'react';
import type {
  CountsByDifficulty,
  PracticeOverview,
  SubjectNode,
} from '@/lib/practice/overview';

export type PracticeScope = {
  kind: 'topic' | 'category' | 'subject';
  slug: string;
  label: string;
  difficulty: DifficultyFilter;
};

export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

const FILTERS: Array<{ id: DifficultyFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

/** Accent per subject: Reading & Writing reads green, Math reads gold. */
function accentFor(slug: string) {
  return slug === 'math' ? 'gold' : 'green';
}

function pct(attempted: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((attempted / total) * 100));
}

export function PracticeBrowse({
  overview,
  onStart,
}: {
  overview: PracticeOverview;
  onStart: (scope: PracticeScope) => void;
}) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');

  // Counts for every difficulty ship in the payload, so switching the filter
  // is instant — no refetch.
  const pick = useMemo(
    () => (counts: CountsByDifficulty) => counts[difficulty],
    [difficulty]
  );

  return (
    <div className="pbr">
      <div className="pbr-filters" role="group" aria-label="Filter by difficulty">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`pbr-chip${difficulty === f.id ? ' on' : ''}`}
            aria-pressed={difficulty === f.id}
            onClick={() => setDifficulty(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="pbr-cols">
        {overview.subjects.map(subject => (
          <SubjectColumn
            key={subject.id}
            subject={subject}
            difficulty={difficulty}
            pick={pick}
            onStart={onStart}
          />
        ))}
      </div>
    </div>
  );
}

function SubjectColumn({
  subject,
  difficulty,
  pick,
  onStart,
}: {
  subject: SubjectNode;
  difficulty: DifficultyFilter;
  pick: (counts: CountsByDifficulty) => number;
  onStart: (scope: PracticeScope) => void;
}) {
  const total = pick(subject.questionCount);
  const attempted = pick(subject.attemptedCount);

  return (
    <section className="pbr-col" data-accent={accentFor(subject.slug)}>
      <header className="pbr-col-head">
        <div className="pbr-col-title">
          <h2 className="pbr-subject">{subject.name}</h2>
          <p className="pbr-subject-meta">
            <span className="pbr-num">{total.toLocaleString()}</span>{' '}
            {total === 1 ? 'question' : 'questions'}
          </p>
        </div>
        <button
          type="button"
          className="pbr-start"
          disabled={total === 0}
          onClick={() =>
            onStart({
              kind: 'subject',
              slug: subject.slug,
              label: subject.name,
              difficulty,
            })
          }
        >
          Start
        </button>
      </header>

      <div className="pbr-col-progress">
        <Track attempted={attempted} total={total} />
        <span className="pbr-num pbr-col-count">
          {attempted.toLocaleString()}/{total.toLocaleString()} attempted
        </span>
      </div>

      {subject.categories.map(category => {
        const catTotal = pick(category.questionCount);
        const catAttempted = pick(category.attemptedCount);
        return (
          <div key={category.id} className="pbr-domain">
            {/* The domain is practisable in its own right — and it's the only
                way to reach questions that have no skill assigned yet. */}
            <button
              type="button"
              className="pbr-domain-head"
              disabled={catTotal === 0}
              title={
                catTotal === 0
                  ? 'No questions here yet'
                  : `Practise all of ${category.name}`
              }
              onClick={() =>
                onStart({
                  kind: 'category',
                  slug: category.slug,
                  label: category.name,
                  difficulty,
                })
              }
            >
              <h3 className="pbr-domain-name">{category.name}</h3>
              <span className="pbr-num pbr-domain-count">
                {catAttempted.toLocaleString()}/{catTotal.toLocaleString()}
              </span>
            </button>

            <ul className="pbr-skills">
              {category.topics.map(topic => {
                const topicTotal = pick(topic.questionCount);
                const topicAttempted = pick(topic.attemptedCount);
                const empty = topicTotal === 0;
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className="pbr-skill"
                      disabled={empty}
                      title={empty ? 'No questions here yet' : `Practise ${topic.name}`}
                      onClick={() =>
                        onStart({
                          kind: 'topic',
                          slug: topic.slug,
                          label: topic.name,
                          difficulty,
                        })
                      }
                    >
                      <Bubble attempted={topicAttempted} total={topicTotal} />
                      <span className="pbr-skill-name">{topic.name}</span>
                      <span className="pbr-num pbr-skill-count">
                        {topicAttempted.toLocaleString()}/{topicTotal.toLocaleString()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The answer-sheet bubble, carried over from the question view: an empty ring
 * that fills as the topic gets completed.
 */
function Bubble({ attempted, total }: { attempted: number; total: number }) {
  const p = pct(attempted, total);
  return (
    <span
      className="pbr-bub"
      style={{ '--p': p } as React.CSSProperties}
      data-full={p >= 100 ? '' : undefined}
      aria-hidden="true"
    />
  );
}

function Track({ attempted, total }: { attempted: number; total: number }) {
  const p = pct(attempted, total);
  return (
    <span className="pbr-track" aria-hidden="true">
      <span className="pbr-track-fill" style={{ width: `${p}%` }} />
    </span>
  );
}
