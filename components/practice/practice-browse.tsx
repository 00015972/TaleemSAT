'use client';

import { createElement, useCallback, useMemo, useState, type CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import {
  FiArrowRight,
  FiCheckSquare,
  FiChevronDown,
  FiEdit3,
  FiFolder,
  FiInfo,
  FiLayers,
  FiSearch,
  FiTarget,
  FiX,
} from 'react-icons/fi';
import {
  FaChartPie,
  FaDrawPolygon,
  FaSquareRootVariable,
  FaSuperscript,
} from 'react-icons/fa6';
import { AppMenuButton } from '@/components/app-menu-button';
import { MathPortalArt, ReadingPortalArt } from '@/components/practice/practice-arcade-art';
import type {
  CategoryNode,
  CountsByDifficulty,
  PracticeOverview,
  SubjectNode,
  TopicNode,
} from '@/lib/practice/overview';

export type PracticeScope = {
  kind: 'topic' | 'category' | 'subject';
  slug: string;
  label: string;
  subjectSlug: string;
  difficulty: DifficultyFilter;
};

export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

const FILTERS: Array<{ id: DifficultyFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const CATEGORY_ICON: Record<string, IconType> = {
  'information-and-ideas': FiInfo,
  'craft-and-structure': FiLayers,
  'expression-of-ideas': FiEdit3,
  'standard-english-conventions': FiCheckSquare,
  algebra: FaSquareRootVariable,
  'advanced-math': FaSuperscript,
  'problem-solving-data-analysis': FaChartPie,
  'geometry-trigonometry': FaDrawPolygon,
};

type CategoryEntry = {
  subject: SubjectNode;
  category: CategoryNode;
};

type SearchCategory = CategoryEntry & {
  topics: TopicNode[];
};

type SearchGroup = {
  subject: SubjectNode;
  categories: SearchCategory[];
};

function accentFor(slug: string) {
  return slug === 'math' ? 'gold' : 'green';
}

function categoryIcon(slug: string): IconType {
  return CATEGORY_ICON[slug] ?? FiFolder;
}

function pct(attempted: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((attempted / total) * 100));
}

function scopeFor(
  kind: PracticeScope['kind'],
  node: { slug: string; name: string },
  difficulty: DifficultyFilter,
  subjectSlug = node.slug
): PracticeScope {
  return { kind, slug: node.slug, label: node.name, subjectSlug, difficulty };
}

export function PracticeBrowse({
  overview,
  onStart,
}: {
  overview: PracticeOverview;
  onStart: (scope: PracticeScope) => void;
}) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    const categories = overview.subjects.flatMap(subject => subject.categories);
    return (
      categories.find(category => category.slug === 'expression-of-ideas')?.id ??
      categories[0]?.id ??
      null
    );
  });

  const pick = useCallback(
    (counts: CountsByDifficulty) => counts[difficulty],
    [difficulty]
  );

  const categoryEntries = useMemo<CategoryEntry[]>(
    () =>
      overview.subjects.flatMap(subject =>
        subject.categories.map(category => ({ subject, category }))
      ),
    [overview.subjects]
  );

  const activeEntry = useMemo(
    () => categoryEntries.find(entry => entry.category.id === activeCategoryId) ?? null,
    [activeCategoryId, categoryEntries]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;

  const searchGroups = useMemo<SearchGroup[]>(() => {
    if (!searching) return [];

    return overview.subjects
      .map(subject => {
        const categories = subject.categories
          .map(category => {
            const categoryMatches = category.name.toLowerCase().includes(normalizedQuery);
            const topics = categoryMatches
              ? category.topics
              : category.topics.filter(topic =>
                  topic.name.toLowerCase().includes(normalizedQuery)
                );
            return { subject, category, topics };
          })
          .filter(
            entry =>
              entry.category.name.toLowerCase().includes(normalizedQuery) ||
              entry.topics.length > 0
          );

        return { subject, categories };
      })
      .filter(group => group.categories.length > 0);
  }, [normalizedQuery, overview.subjects, searching]);

  const matchingCategoryIds = useMemo(
    () =>
      new Set(
        searchGroups.flatMap(group => group.categories.map(entry => entry.category.id))
      ),
    [searchGroups]
  );

  const focusSubject = useMemo(() => {
    let best: SubjectNode | null = null;
    let bestRatio = Infinity;

    for (const subject of overview.subjects) {
      const total = pick(subject.questionCount);
      if (total === 0) continue;
      const ratio = pick(subject.attemptedCount) / total;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = subject;
      }
    }

    return best ?? overview.subjects[0] ?? null;
  }, [overview.subjects, pick]);

  function toggleCategory(id: string) {
    if (searching) {
      setQuery('');
      setActiveCategoryId(id);
      return;
    }
    setActiveCategoryId(current => (current === id ? null : id));
  }

  const hasPublishedQuestions = overview.subjects.some(
    subject => subject.questionCount.all > 0
  );

  return (
    <div className="practice-arcade">
      <div className="qba-glow qba-glow-one" aria-hidden="true" />
      <div className="qba-glow qba-glow-two" aria-hidden="true" />

      <div className="qba-inner">
        <header className="qba-header qba-reveal qba-reveal-one">
          <div className="qba-heading">
            <p className="qba-eyebrow">Practice arcade</p>
            <div className="qba-heading-row">
              <AppMenuButton className="qba-inline-menu" />
              <div className="qba-heading-copy">
                <h1>Pick a deck. Start a run.</h1>
                <p>
                  Build skills in short, satisfying rounds—your progress is always on
                  the cabinet.
                </p>
              </div>
            </div>
          </div>

          <div className="qba-tools">
            <label className="qba-search">
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search practice decks or topics…"
                aria-label="Search practice decks or topics"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <FiX aria-hidden="true" />
                </button>
              )}
            </label>

            <div className="qba-filters" role="group" aria-label="Filter by difficulty">
              {FILTERS.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  className={difficulty === filter.id ? 'active' : ''}
                  aria-pressed={difficulty === filter.id}
                  onClick={() => setDifficulty(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!hasPublishedQuestions ? (
          <EmptyCabinet />
        ) : (
          <>
            <section className="qba-portals" aria-label="Practice by subject">
              {overview.subjects.map((subject, index) => (
                <SubjectPortal
                  key={subject.id}
                  subject={subject}
                  difficulty={difficulty}
                  attempted={pick(subject.attemptedCount)}
                  total={pick(subject.questionCount)}
                  delay={index}
                  onStart={() => onStart(scopeFor('subject', subject, difficulty))}
                />
              ))}
            </section>

            <section className="qba-cabinet qba-reveal qba-reveal-four">
              <header className="qba-cabinet-head">
                <div>
                  <p className="qba-label">Choose a practice deck</p>
                  <h2>All SAT skill categories</h2>
                </div>
                <p>Click a deck to open its topics and progress</p>
              </header>

              <div className="qba-shelves">
                {overview.subjects.map(subject => (
                  <DeckShelf
                    key={subject.id}
                    subject={subject}
                    difficulty={difficulty}
                    pick={pick}
                    activeCategoryId={activeCategoryId}
                    searching={searching}
                    matchingCategoryIds={matchingCategoryIds}
                    onToggle={toggleCategory}
                  />
                ))}
              </div>

              {searching ? (
                <SearchTray
                  groups={searchGroups}
                  query={query.trim()}
                  difficulty={difficulty}
                  pick={pick}
                  onStart={onStart}
                  onClear={() => setQuery('')}
                />
              ) : activeEntry ? (
                <TopicTray
                  entry={activeEntry}
                  difficulty={difficulty}
                  pick={pick}
                  onStart={onStart}
                  onClose={() => setActiveCategoryId(null)}
                />
              ) : null}
            </section>

            {focusSubject && (
              <Recommendation
                subject={focusSubject}
                difficulty={difficulty}
                onStart={() => onStart(scopeFor('subject', focusSubject, difficulty))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SubjectPortal({
  subject,
  difficulty,
  attempted,
  total,
  delay,
  onStart,
}: {
  subject: SubjectNode;
  difficulty: DifficultyFilter;
  attempted: number;
  total: number;
  delay: number;
  onStart: () => void;
}) {
  const math = subject.slug === 'math';
  const percentage = pct(attempted, total);

  return (
    <article
      className={`qba-portal qba-portal-${math ? 'math' : 'reading'} qba-reveal qba-reveal-${delay + 2}`}
    >
      <div className="qba-portal-copy">
        <p className="qba-label">{subject.name}</p>
        <h2>
          {math ? <><span>Turn problems</span><span>into points.</span></> : <><span>Read sharper.</span><span>Write smarter.</span></>}
        </h2>
        <p className="qba-portal-meta">
          {total.toLocaleString()} {total === 1 ? 'question' : 'questions'} ·{' '}
          {subject.categories.length} skill worlds
        </p>
        <span className="qba-progress" aria-hidden="true">
          <span
            key={difficulty}
            className="qba-progress-fill"
            style={{ '--qba-progress': `${percentage}%` } as CSSProperties}
          />
        </span>
        <p className="qba-portal-count">
          {attempted.toLocaleString()} of {total.toLocaleString()} attempted
        </p>
        <button type="button" disabled={total === 0} onClick={onStart}>
          Enter {math ? 'Math' : 'Reading'} <FiArrowRight aria-hidden="true" />
        </button>
      </div>
      {math ? <MathPortalArt /> : <ReadingPortalArt />}
    </article>
  );
}

function DeckShelf({
  subject,
  difficulty,
  pick,
  activeCategoryId,
  searching,
  matchingCategoryIds,
  onToggle,
}: {
  subject: SubjectNode;
  difficulty: DifficultyFilter;
  pick: (counts: CountsByDifficulty) => number;
  activeCategoryId: string | null;
  searching: boolean;
  matchingCategoryIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const accent = accentFor(subject.slug);
  const subjectTotal = pick(subject.questionCount);

  return (
    <section className="qba-shelf" data-accent={accent}>
      <header>
        <strong>{subject.name}</strong>
        <span>{subjectTotal.toLocaleString()} {subjectTotal === 1 ? 'question' : 'questions'}</span>
      </header>
      <div className="qba-decks">
        {subject.categories.map(category => {
          const total = pick(category.questionCount);
          const attempted = pick(category.attemptedCount);
          const active = activeCategoryId === category.id && !searching;
          const matches = !searching || matchingCategoryIds.has(category.id);
          const icon = createElement(categoryIcon(category.slug));

          return (
            <button
              key={category.id}
              type="button"
              className={`qba-deck${active ? ' active' : ''}${searching && matches ? ' match' : ''}${searching && !matches ? ' muted' : ''}`}
              disabled={total === 0}
              aria-expanded={active}
              aria-controls="qba-topic-tray"
              title={total === 0 ? `No ${difficulty} questions in ${category.name}` : `Open ${category.name} topics`}
              onClick={() => onToggle(category.id)}
            >
              <span className="qba-deck-icon" aria-hidden="true">{icon}</span>
              <FiChevronDown className="qba-deck-arrow" aria-hidden="true" />
              <strong>{category.name}</strong>
              <small>{attempted.toLocaleString()} / {total.toLocaleString()}</small>
              <i className="qba-deck-orb" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TopicTray({
  entry,
  difficulty,
  pick,
  onStart,
  onClose,
}: {
  entry: CategoryEntry;
  difficulty: DifficultyFilter;
  pick: (counts: CountsByDifficulty) => number;
  onStart: (scope: PracticeScope) => void;
  onClose: () => void;
}) {
  const { subject, category } = entry;
  const total = pick(category.questionCount);
  const attempted = pick(category.attemptedCount);
  const icon = createElement(categoryIcon(category.slug));

  return (
    <section
      className="qba-topic-tray"
      id="qba-topic-tray"
      data-accent={accentFor(subject.slug)}
      aria-labelledby="qba-topic-tray-title"
    >
      <header className="qba-tray-head">
        <div className="qba-tray-title">
          <span aria-hidden="true">{icon}</span>
          <div>
            <h3 id="qba-topic-tray-title">{category.name}</h3>
            <p>
              {attempted.toLocaleString()} of {total.toLocaleString()} attempted ·{' '}
              {category.topics.length} {category.topics.length === 1 ? 'topic' : 'topics'}
            </p>
          </div>
        </div>
        <div className="qba-tray-actions">
          <button
            type="button"
            className="qba-practice-category"
            disabled={total === 0}
            onClick={() => onStart(scopeFor('category', category, difficulty, subject.slug))}
          >
            Practice all {category.name} <FiArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="qba-tray-close" onClick={onClose} aria-label={`Close ${category.name} topics`}>
            <FiX aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="qba-topic-grid">
        {category.topics.map(topic => (
          <TopicButton
            key={topic.id}
            topic={topic}
            subjectSlug={subject.slug}
            difficulty={difficulty}
            pick={pick}
            onStart={onStart}
          />
        ))}
      </div>
    </section>
  );
}

function SearchTray({
  groups,
  query,
  difficulty,
  pick,
  onStart,
  onClear,
}: {
  groups: SearchGroup[];
  query: string;
  difficulty: DifficultyFilter;
  pick: (counts: CountsByDifficulty) => number;
  onStart: (scope: PracticeScope) => void;
  onClear: () => void;
}) {
  const resultCount = groups.reduce(
    (sum, group) =>
      sum + group.categories.reduce((categorySum, entry) => categorySum + entry.topics.length, 0),
    0
  );

  return (
    <section className="qba-topic-tray qba-search-tray" id="qba-topic-tray" aria-labelledby="qba-search-title">
      <header className="qba-tray-head">
        <div className="qba-tray-title">
          <span aria-hidden="true"><FiSearch /></span>
          <div>
            <h3 id="qba-search-title">Results for “{query}”</h3>
            <p>{resultCount} matching {resultCount === 1 ? 'topic' : 'topics'}</p>
          </div>
        </div>
        <button type="button" className="qba-tray-close" onClick={onClear} aria-label="Clear search">
          <FiX aria-hidden="true" />
        </button>
      </header>

      {groups.length === 0 ? (
        <div className="qba-no-results">
          <span aria-hidden="true">?</span>
          <div>
            <h4>No deck matches that search.</h4>
            <p>Try a broader skill name or clear the search to browse every category.</p>
          </div>
          <button type="button" onClick={onClear}>Clear search</button>
        </div>
      ) : (
        <div className="qba-search-groups">
          {groups.map(group => (
            <section key={group.subject.id} className="qba-search-subject" data-accent={accentFor(group.subject.slug)}>
              <h4>{group.subject.name}</h4>
              {group.categories.map(entry => (
                <div key={entry.category.id} className="qba-search-category">
                  <header>
                    <strong>{entry.category.name}</strong>
                    <button
                      type="button"
                      disabled={pick(entry.category.questionCount) === 0}
                      onClick={() => onStart(scopeFor('category', entry.category, difficulty, group.subject.slug))}
                    >
                      Practice category <FiArrowRight aria-hidden="true" />
                    </button>
                  </header>
                  <div className="qba-topic-grid">
                    {entry.topics.map(topic => (
                      <TopicButton
                        key={topic.id}
                        topic={topic}
                        subjectSlug={group.subject.slug}
                        difficulty={difficulty}
                        pick={pick}
                        onStart={onStart}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function TopicButton({
  topic,
  subjectSlug,
  difficulty,
  pick,
  onStart,
}: {
  topic: TopicNode;
  subjectSlug: string;
  difficulty: DifficultyFilter;
  pick: (counts: CountsByDifficulty) => number;
  onStart: (scope: PracticeScope) => void;
}) {
  const total = pick(topic.questionCount);
  const attempted = pick(topic.attemptedCount);
  const percentage = pct(attempted, total);

  return (
    <button
      type="button"
      className="qba-topic"
      disabled={total === 0}
      title={total === 0 ? `No ${difficulty} questions in ${topic.name}` : `Practice ${topic.name}`}
      onClick={() => onStart(scopeFor('topic', topic, difficulty, subjectSlug))}
    >
      <span
        className="qba-topic-bubble"
        style={{ '--qba-topic-progress': percentage } as CSSProperties}
        aria-hidden="true"
      >
        <i />
      </span>
      <span className="qba-topic-name">{topic.name}</span>
      <span className="qba-topic-count">{attempted.toLocaleString()} / {total.toLocaleString()}</span>
      <FiArrowRight className="qba-topic-arrow" aria-hidden="true" />
    </button>
  );
}

function Recommendation({
  subject,
  difficulty,
  onStart,
}: {
  subject: SubjectNode;
  difficulty: DifficultyFilter;
  onStart: () => void;
}) {
  const difficultyCopy =
    difficulty === 'all' ? 'across all difficulty levels' : `at the ${difficulty} level`;

  return (
    <section className="qba-recommendation qba-reveal qba-reveal-five" data-accent={accentFor(subject.slug)}>
      <span className="qba-target" aria-hidden="true"><FiTarget /></span>
      <div>
        <p className="qba-label">Recommended next deck</p>
        <h2>Build momentum in {subject.name}.</h2>
        <p>We picked the subject with the most room to grow {difficultyCopy}.</p>
      </div>
      <button type="button" onClick={onStart}>
        Start recommended practice <FiArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function EmptyCabinet() {
  return (
    <section className="qba-empty qba-reveal qba-reveal-two">
      <span aria-hidden="true"><i /><i /><i /></span>
      <h2>The practice cabinet is being stocked.</h2>
      <p>No published questions are available yet. Check back once your first decks are ready.</p>
    </section>
  );
}
