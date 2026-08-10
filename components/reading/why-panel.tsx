'use client';

import { useState } from 'react';

/**
 * "Why is this the answer?" — an on-demand AI walkthrough shown after a question
 * has been scored. Lazy: nothing is fetched until the student clicks. The server
 * caches one explanation per question, so the first curious student pays for Groq
 * and everyone after gets it instantly.
 */

type Explanation = {
  summary: string;
  steps: string[];
  distractors: { option: string; why_wrong: string }[];
  tip: string;
};

type State = 'idle' | 'loading' | 'error' | 'done';

export function WhyPanel({
  questionId,
  pro = false,
}: {
  questionId: string;
  /** Pro/Elite unlocks the AI walkthrough; free users get an upgrade teaser. */
  pro?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const [data, setData] = useState<Explanation | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    // Free users never trigger a Groq call — they see a locked teaser.
    if (!pro) {
      setOpen(o => !o);
      return;
    }
    if (data) {
      setOpen(o => !o);
      return;
    }
    setState('loading');
    setOpen(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });
      const d = (await res.json()) as { ok?: boolean; explanation?: Explanation };
      if (d.ok && d.explanation) {
        setData(d.explanation);
        setState('done');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="why">
      <button
        type="button"
        className={`why-btn${open ? ' on' : ''}${pro ? '' : ' locked'}`}
        onClick={handleClick}
        disabled={state === 'loading'}
        aria-expanded={open}
      >
        <span aria-hidden="true">{pro ? '✨' : '🔒'}</span>
        {state === 'loading'
          ? 'Thinking…'
          : data && open
            ? 'Hide explanation'
            : 'Why is this the answer?'}
      </button>

      {open && !pro && (
        <div className="why-panel why-lock prx-anim">
          <p className="why-summary">A full AI walkthrough — with reasoning steps and why each wrong option misses — is a Pro feature.</p>
          <a href="/settings" className="why-lock-cta">Upgrade to Pro to unlock →</a>
        </div>
      )}

      {open && pro && state === 'error' && (
        <p className="why-err">Couldn&apos;t generate an explanation right now. Try again in a moment.</p>
      )}

      {open && pro && data && (
        <div className="why-panel prx-anim">
          <p className="why-summary">{data.summary}</p>

          {data.steps.length > 0 && (
            <ol className="why-steps">
              {data.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}

          {data.distractors.length > 0 && (
            <div className="why-distractors">
              <p className="why-sub">Why the others miss</p>
              {data.distractors.map((d, i) => (
                <p key={i} className="why-distractor">
                  <span className="why-opt">{d.option}</span>
                  {d.why_wrong}
                </p>
              ))}
            </div>
          )}

          {data.tip && (
            <p className="why-tip">
              <span className="why-tip-label">Tip</span>
              {data.tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
