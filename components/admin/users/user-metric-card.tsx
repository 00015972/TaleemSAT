'use client';

import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';

export function UserMetricCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  detail,
  tone,
  delay,
}: {
  icon: IconType;
  label: string;
  value: number | null;
  suffix?: string;
  detail: React.ReactNode;
  tone: 'primary' | 'green' | 'gold' | 'health';
  delay: number;
}) {
  const displayValue = useCountUp(value);

  return (
    <article
      className={`users-pulse-metric ${tone}`}
      style={{ '--users-enter-delay': `${delay}s` } as React.CSSProperties}
    >
      <div className="users-pulse-metric-head">
        <span><Icon aria-hidden="true" /></span>
        <label>{label}</label>
      </div>
      <strong>{value === null ? '—' : `${displayValue.toLocaleString('en-US')}${suffix}`}</strong>
      <small>{detail}</small>
      <i aria-hidden="true">
        <span /><span /><span /><span /><span />
      </i>
    </article>
  );
}

function useCountUp(value: number | null): number {
  const [display, setDisplay] = useState(value ?? 0);

  useEffect(() => {
    if (value === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(reducedMotionFrame);
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = 850;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}
