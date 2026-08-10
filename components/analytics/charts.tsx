/**
 * Hand-built SVG charts for the analytics page. No charting dependency: these
 * are pure presentational components (no hooks), so they render on the server
 * and animate purely via CSS (see the `.an-ring`, `.an-radar`, `.an-area`
 * blocks in globals.css). Colors come from design tokens so they theme cleanly.
 */

import type { CSSProperties } from 'react';
import type { DailyPoint } from '@/lib/analytics/overview';

/** Accuracy → semantic token. Mirrors the bar coloring on the page. */
function accuracyColor(v: number): string {
  if (v >= 0.7) return 'var(--green)';
  if (v >= 0.5) return 'var(--gold-d)';
  return 'var(--err)';
}

/* ─── Score ring (donut) ────────────────────────────────────────────────── */

export function ScoreRing({
  value,
  size = 132,
  stroke = 12,
  trackColor = 'rgba(255,255,255,0.22)',
  fillColor = '#ecc94b',
  textColor = '#ffffff',
}: {
  value: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  textColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dash = c * pct;
  const cx = size / 2;

  return (
    <svg
      className="an-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(pct * 100)} percent overall accuracy`}
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        className="an-ring-fill"
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={fillColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={
          {
            // CSS keyframe reads --an-c to draw the arc on from empty.
            '--an-c': `${c}px`,
            strokeDasharray: `${dash}px ${c}px`,
          } as CSSProperties
        }
      />
      <text
        x="50%"
        y="46%"
        className="an-ring-num"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: textColor }}
      >
        {Math.round(pct * 100)}%
      </text>
      <text
        x="50%"
        y="64%"
        className="an-ring-lbl"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: textColor, opacity: 0.75 }}
      >
        accuracy
      </text>
    </svg>
  );
}

/* ─── Radar / spider chart ──────────────────────────────────────────────── */

export function RadarChart({
  axes,
  size = 280,
}: {
  axes: { label: string; value: number }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46; // room for labels around the rim
  const n = axes.length;

  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, radius: number): [number, number] => [
    cx + radius * Math.cos(angle(i)),
    cy + radius * Math.sin(angle(i)),
  ];
  const polyAt = (radius: number) =>
    axes.map((_, i) => point(i, radius).join(',')).join(' ');

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoly = axes
    .map((a, i) => point(i, R * Math.max(0.03, Math.min(1, a.value))).join(','))
    .join(' ');

  return (
    <svg
      className="an-radar"
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Category mastery radar"
    >
      {/* grid rings */}
      {rings.map(t => (
        <polygon
          key={t}
          className="an-radar-ring"
          points={polyAt(R * t)}
        />
      ))}
      {/* spokes */}
      {axes.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} className="an-radar-spoke" x1={cx} y1={cy} x2={x} y2={y} />;
      })}

      {/* animated data layer */}
      <g
        className="an-radar-data"
        style={{ '--an-cx': `${cx}px`, '--an-cy': `${cy}px` } as CSSProperties}
      >
        <polygon className="an-radar-poly" points={dataPoly} />
        {axes.map((a, i) => {
          const [x, y] = point(i, R * Math.max(0.03, Math.min(1, a.value)));
          return (
            <circle
              key={i}
              className="an-radar-dot"
              cx={x}
              cy={y}
              r={4}
              style={{ fill: accuracyColor(a.value) }}
            />
          );
        })}
      </g>

      {/* axis labels */}
      {axes.map((a, i) => {
        const [x, y] = point(i, R + 16);
        const cos = Math.cos(angle(i));
        const sin = Math.sin(angle(i));
        const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
        const dy = sin > 0.5 ? 10 : sin < -0.5 ? -4 : 4;
        return (
          <text
            key={i}
            className="an-radar-label"
            x={x}
            y={y + dy}
            textAnchor={anchor}
          >
            {shorten(a.label)}
          </text>
        );
      })}
    </svg>
  );
}

function shorten(label: string): string {
  if (label.length <= 16) return label;
  // keep it readable on the rim — drop trailing words past ~16 chars
  const words = label.split(' ');
  let out = '';
  for (const w of words) {
    if ((out + ' ' + w).trim().length > 16) break;
    out = (out + ' ' + w).trim();
  }
  return out || label.slice(0, 14);
}

/* ─── Progress area chart (daily) ───────────────────────────────────────── */

export function ProgressArea({ points }: { points: DailyPoint[] }) {
  const W = 320;
  const H = 168;
  const padL = 26;
  const padR = 14;
  const padT = 10;
  const padB = 36; // room for two-line labels (month + day)
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = points.length;

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(1, v))) * plotH;

  // Only days with attempts contribute to the line.
  const live = points
    .map((p, i) => ({ i, p }))
    .filter(d => d.p.attempts > 0);

  const linePath =
    live.length > 0
      ? live.map((d, k) => `${k === 0 ? 'M' : 'L'} ${x(d.i).toFixed(1)} ${y(d.p.accuracy).toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    live.length > 1
      ? `${linePath} L ${x(live[live.length - 1].i).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${x(live[0].i).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const guides = [0, 0.5, 1];

  // Per-point metadata: is it a Monday (week marker) and/or first of its month?
  const annotated = points.map((p, i) => {
    const d = new Date(p.date + 'T00:00:00');
    const isMonday = d.getDay() === 1;
    const prevMonth = i > 0 ? new Date(points[i - 1].date + 'T00:00:00').getMonth() : -1;
    const showMonth = i === 0 || d.getMonth() !== prevMonth;
    const anchor: 'start' | 'middle' | 'end' =
      i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return { i, p, d, isMonday, showMonth, anchor };
  });

  return (
    <svg
      className="an-chart"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Accuracy over the last 14 days"
    >
      <defs>
        <linearGradient id="an-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* vertical week guides at Mondays */}
      {annotated.filter(a => a.isMonday).map(a => (
        <line
          key={a.i}
          x1={x(a.i)} y1={padT}
          x2={x(a.i)} y2={padT + plotH}
          stroke="var(--gold)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3"
        />
      ))}

      {/* horizontal guides + y labels */}
      {guides.map(g => (
        <g key={g}>
          <line className="an-grid-line" x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} />
          <text className="an-axis-label" x={padL - 6} y={y(g) + 3} textAnchor="end">
            {Math.round(g * 100)}
          </text>
        </g>
      ))}

      {areaPath && <path className="an-area" d={areaPath} fill="url(#an-area-grad)" />}
      {linePath && <path className="an-line" d={linePath} pathLength={1} />}

      {live.map(d => (
        <circle
          key={d.i}
          className="an-dot"
          cx={x(d.i)}
          cy={y(d.p.accuracy)}
          r={3.5}
          style={{ fill: accuracyColor(d.p.accuracy) }}
        >
          <title>{`${d.p.date}: ${Math.round(d.p.accuracy * 100)}% (${d.p.attempts})`}</title>
        </circle>
      ))}

      {/* all 14 day labels — Mondays in gold, month name above when month changes */}
      {annotated.map(a => (
        <g key={a.i}>
          {a.showMonth && (
            <text
              className="an-axis-label"
              x={x(a.i)}
              y={H - 20}
              textAnchor={a.anchor}
              style={{ fill: 'var(--gold-d)', fontSize: '7px', fontWeight: 700, letterSpacing: '0.04em' }}
            >
              {a.d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </text>
          )}
          <text
            className="an-axis-label"
            x={x(a.i)}
            y={H - 9}
            textAnchor={a.anchor}
            style={a.isMonday ? { fill: 'var(--gold-d)', fontWeight: 700 } : undefined}
          >
            {a.d.getDate()}
          </text>
        </g>
      ))}
    </svg>
  );
}
