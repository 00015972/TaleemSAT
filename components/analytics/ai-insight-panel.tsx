'use client';

import { useEffect, useState } from 'react';

type Insight = {
  headline: string;
  weak_category: string;
  weak_subtopics: string[];
  reasoning: string;
  recommendation: string;
  estimated_score_gain: string;
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

const URGENCY_STYLE: Record<Insight['urgency'], { bg: string; color: string }> = {
  high: { bg: 'color-mix(in srgb, var(--err) 14%, transparent)', color: 'var(--err)' },
  medium: { bg: 'color-mix(in srgb, var(--gold-d) 16%, transparent)', color: 'var(--gold-d)' },
  low: { bg: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green-d)' },
};

/** Fetch + map to a render state. Module-level and pure — no setState — so the
 *  mount effect can resolve it in a `.then` without tripping react-hooks rules. */
async function fetchInsightState(refresh: boolean): Promise<State> {
  try {
    const res = await fetch(`/api/ai/insights${refresh ? '?refresh=1' : ''}`);
    const data = (await res.json()) as ApiResponse;
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

export function AiInsightPanel() {
  const [state, setState] = useState<State>({ name: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInsightState(false).then(s => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    const s = await fetchInsightState(true);
    setState(s);
    setRefreshing(false);
  }

  if (state.name === 'loading') {
    return (
      <div className="an-insight">
        <div className="an-skel" style={{ width: '40%', height: '0.8rem', marginBottom: '0.9rem' }} />
        <div className="an-skel" style={{ width: '85%', height: '1.2rem', marginBottom: '0.7rem' }} />
        <div className="an-skel" style={{ width: '100%', marginBottom: '0.4rem' }} />
        <div className="an-skel" style={{ width: '90%' }} />
      </div>
    );
  }

  if (state.name === 'insufficient') {
    return (
      <div className="an-lock">
        <p className="app-label" style={{ marginBottom: '0.4rem' }}>AI insight</p>
        <p className="text-sm" style={{ color: 'var(--txt-soft)' }}>
          Answer <strong>{state.needed - state.have}</strong> more practice question
          {state.needed - state.have === 1 ? '' : 's'} to unlock your personalized
          weakness analysis.
        </p>
      </div>
    );
  }

  if (state.name === 'rate_limited') {
    return (
      <div className="an-lock">
        <p className="text-sm" style={{ color: 'var(--txt-soft)' }}>
          You&apos;ve refreshed your insight several times today. Check back tomorrow
          for a fresh analysis.
        </p>
      </div>
    );
  }

  if (state.name === 'error') {
    return (
      <div className="an-insight">
        <div className="an-insight-head">
          <p className="app-label">AI insight</p>
        </div>
        <p className="text-sm" style={{ color: 'var(--txt-soft)' }}>
          Insight unavailable right now.
        </p>
        <button className="an-refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    );
  }

  const { insight, cached } = state;
  const urg = URGENCY_STYLE[insight.urgency];

  return (
    <div className="an-insight">
      <div className="an-insight-head">
        <p className="app-label">AI insight</p>
        <span className="an-urg" style={{ background: urg.bg, color: urg.color }}>
          {insight.urgency} priority
        </span>
      </div>

      <h3 className="an-insight-headline">{insight.headline}</h3>

      {insight.weak_subtopics.length > 0 && (
        <div className="an-chips">
          {insight.weak_subtopics.map(t => (
            <span key={t} className="an-chip">{t}</span>
          ))}
        </div>
      )}

      <p className="an-insight-body">{insight.reasoning}</p>

      <div className="an-rec">
        <p className="app-label" style={{ marginBottom: '0.3rem' }}>What to do</p>
        <p className="an-insight-body" style={{ margin: 0 }}>{insight.recommendation}</p>
        <p className="an-gain">Estimated gain: {insight.estimated_score_gain}</p>
      </div>

      <div className="an-insight-foot">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {cached ? 'Cached analysis' : 'Fresh analysis'}
        </span>
        <button className="an-refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
