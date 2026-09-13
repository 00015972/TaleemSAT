'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import type { CategoryStat } from '@/lib/analytics/overview';

type Insight = {
  headline: string;
  weak_category: string;
  weak_subtopics: string[];
  reasoning: string;
  recommendation: string;
  urgency: 'high' | 'medium' | 'low';
};

type ApiResponse =
  | { ok: true; cached: boolean; insight: Insight; generatedAt: string }
  | { ok: false; reason: 'insufficient_data'; have: number; needed: number }
  | { ok: false; reason: 'rate_limited' | 'unavailable' | 'tier_locked' };

type State =
  | { name: 'loading' }
  | { name: 'ok'; insight: Insight; cached: boolean }
  | { name: 'insufficient'; have: number; needed: number }
  | { name: 'rate_limited' }
  | { name: 'error' };

async function fetchInsightState(refresh: boolean): Promise<State> {
  try {
    const response = await fetch(`/api/ai/insights${refresh ? '?refresh=1' : ''}`);
    const data = (await response.json()) as ApiResponse;
    if (data.ok) return { name: 'ok', insight: data.insight, cached: data.cached };
    if (data.reason === 'insufficient_data') {
      return { name: 'insufficient', have: data.have, needed: data.needed };
    }
    if (data.reason === 'rate_limited') return { name: 'rate_limited' };
    return { name: 'error' };
  } catch {
    return { name: 'error' };
  }
}

function categoryMatches(priority: CategoryStat, insight: Insight) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(priority.category) === normalize(insight.weak_category);
}

export function AiInsightPanel({
  priority,
  potentialGain,
}: {
  priority: CategoryStat | null;
  potentialGain: number | null;
}) {
  const [state, setState] = useState<State>({ name: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInsightState(false).then(next => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    const next = await fetchInsightState(true);
    setState(next);
    setRefreshing(false);
  }

  if (!priority) {
    return (
      <div className="observatory-coach-copy">
        <p className="observatory-label"><Sparkles size={13} /> Coach signal · calibrating</p>
        <h2>Build the evidence.<span>Reveal the leverage.</span></h2>
        <p>Practice at least three questions in a few skill categories and your highest-impact signal will appear here.</p>
        <Link href="/question-bank" className="observatory-outline-button">
          Build your baseline <ArrowRight size={14} />
        </Link>
        <CoachArtwork />
      </div>
    );
  }

  const compatible = state.name === 'ok' && categoryMatches(priority, state.insight);
  const reasoning = compatible
    ? state.insight.reasoning
    : `Your recent work shows the clearest opportunity in ${priority.category}. A short, focused set will add useful evidence and train the pattern while it is fresh.`;
  const recommendation = compatible ? state.insight.recommendation : null;
  const subtopics = compatible ? state.insight.weak_subtopics : priority.topWrongTags;

  return (
    <div className="observatory-coach-copy" aria-busy={state.name === 'loading'}>
      <div className="observatory-coach-topline">
        <p className="observatory-label"><Sparkles size={13} /> Coach signal · highest leverage</p>
        {state.name === 'ok' && (
          <span className={`observatory-urgency is-${state.insight.urgency}`}>
            {state.insight.urgency} priority
          </span>
        )}
      </div>

      <h2>Fix {priority.category}.<span>Unlock the climb.</span></h2>

      {subtopics.length > 0 && (
        <div className="observatory-coach-tags">
          {subtopics.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
        </div>
      )}

      <p>{reasoning}</p>
      {recommendation && <p className="observatory-coach-recommendation">{recommendation}</p>}

      <div className="observatory-coach-actions">
        <Link
          href={`/question-bank?category=${encodeURIComponent(priority.slug)}&mode=focus`}
          className="observatory-outline-button"
        >
          Start 12-question drill <ArrowRight size={14} />
        </Link>
        {potentialGain !== null && (
          <span className="observatory-gain">
            +{potentialGain} readiness if 9 of 12 are correct
          </span>
        )}
      </div>

      <div className="observatory-coach-status">
        <span>{statusCopy(state, compatible)}</span>
        <button type="button" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={12} className={refreshing ? 'is-spinning' : ''} />
          {refreshing ? 'Refreshing' : 'Refresh coach'}
        </button>
      </div>
      <CoachArtwork />
    </div>
  );
}

function statusCopy(state: State, compatible: boolean) {
  if (state.name === 'loading') return 'Loading the coach narrative…';
  if (state.name === 'insufficient') {
    const remaining = Math.max(0, state.needed - state.have);
    return `${remaining} more answer${remaining === 1 ? '' : 's'} unlock the full coach note`;
  }
  if (state.name === 'rate_limited') return 'Using today’s deterministic signal';
  if (state.name === 'error') return 'Coach narrative is temporarily unavailable';
  if (!compatible) return 'Deterministic signal kept; narrative is recalibrating';
  return state.cached ? 'Cached coach narrative' : 'Fresh coach narrative';
}

function CoachArtwork() {
  return (
    <div className="observatory-coach-art" aria-hidden="true">
      <i className="observatory-coach-orb" />
      <span className="observatory-drill-paper">
        <i />
        <strong>NEXT<br />DRILL</strong>
        <b><i /><i /><i className="filled" /><i /></b>
        <i />
      </span>
      <em>✦</em>
    </div>
  );
}
