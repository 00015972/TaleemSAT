'use client';

import Link from 'next/link';
import { useId, useMemo, useState, type CSSProperties } from 'react';

export type AccuracyTrendDatum = {
  createdAt: string;
  attemptNumber: number;
  windowSize: number;
  accuracy: number;
};

type Point = AccuracyTrendDatum & {
  x: number;
  y: number;
};

const WIDTH = 720;
const HEIGHT = 252;
const LEFT = 48;
const RIGHT = 18;
const TOP = 27;
const BOTTOM = 33;
const BASELINE = HEIGHT - BOTTOM;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothPath(points: Point[]) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const firstControlX = current.x + (next.x - before.x) / 6;
    const firstControlY = clamp(current.y + (next.y - before.y) / 6, TOP, BASELINE);
    const secondControlX = next.x - (after.x - current.x) / 6;
    const secondControlY = clamp(next.y - (after.y - current.y) / 6, TOP, BASELINE);
    path += ` C ${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)}, ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

function formatDate(value: string, long = false) {
  return new Date(value).toLocaleDateString('en-US', {
    month: long ? 'long' : 'short',
    day: 'numeric',
  });
}

export function AccuracyTrendChart({ points }: { points: AccuracyTrendDatum[] }) {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const plotted = useMemo<Point[]>(() => {
    const plotWidth = WIDTH - LEFT - RIGHT;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    return points.map((point, index) => ({
      ...point,
      x: LEFT + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
      y: TOP + (1 - clamp(point.accuracy, 0, 1)) * plotHeight,
    }));
  }, [points]);

  if (plotted.length < 2) {
    return (
      <div className="focus-chart-empty">
        <div className="focus-chart-empty-art" aria-hidden="true">
          <i />
          <i />
          <i />
          <span>↗</span>
        </div>
        <div>
          <strong>Your accuracy climb starts here.</strong>
          <p>Answer two practice questions to reveal your first real trend.</p>
          <Link href="/question-bank">Start a mission →</Link>
        </div>
      </div>
    );
  }

  const line = smoothPath(plotted);
  const area = `${line} L ${plotted[plotted.length - 1].x.toFixed(2)} ${BASELINE} L ${plotted[0].x.toFixed(2)} ${BASELINE} Z`;
  const activeIndex = hoveredIndex ?? plotted.length - 1;
  const active = plotted[activeIndex];
  const activePercent = Math.round(active.accuracy * 100);
  const leftPercent = clamp((active.x / WIDTH) * 100, 15, 85);
  const topPercent = clamp((active.y / HEIGHT) * 100, 18, 70);
  const middle = plotted[Math.floor((plotted.length - 1) / 2)];

  return (
    <div className="focus-chart-wrap">
      <svg
        className="focus-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Accuracy over the latest ${plotted.length} attempts`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff806d" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#ff806d" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[1, 0.75, 0.5, 0.25].map(value => {
          const y = TOP + (1 - value) * (BASELINE - TOP);
          return (
            <g key={value} className="focus-chart-grid-row">
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} />
              <text x={LEFT - 10} y={y + 3} textAnchor="end">
                {Math.round(value * 100)}%
              </text>
            </g>
          );
        })}

        <path className="focus-chart-area" d={area} fill={`url(#${gradientId})`} />
        <path className="focus-chart-line" d={line} pathLength={1} />

        <line
          className="focus-chart-guide"
          x1={active.x}
          x2={active.x}
          y1={TOP}
          y2={BASELINE}
        />

        <g className="focus-chart-points">
          {plotted.map((point, index) => {
            const percent = Math.round(point.accuracy * 100);
            return (
              <circle
                key={`${point.createdAt}-${point.attemptNumber}`}
                className="focus-chart-hit"
                cx={point.x}
                cy={point.y}
                r={index === activeIndex ? 7 : 4.5}
                tabIndex={0}
                role="button"
                aria-label={`${formatDate(point.createdAt, true)}, attempt ${point.attemptNumber}: ${percent}% rolling accuracy over ${point.windowSize} answers`}
                style={{ '--focus-point-index': index } as CSSProperties}
                onPointerEnter={() => setHoveredIndex(index)}
                onPointerLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
              />
            );
          })}
        </g>

        <g className="focus-chart-axis">
          <text x={LEFT} y={HEIGHT - 7} textAnchor="start">
            {formatDate(plotted[0].createdAt)}
          </text>
          <text x={middle.x} y={HEIGHT - 7} textAnchor="middle">
            {formatDate(middle.createdAt)}
          </text>
          <text x={WIDTH - RIGHT} y={HEIGHT - 7} textAnchor="end">
            {formatDate(plotted[plotted.length - 1].createdAt)}
          </text>
        </g>
      </svg>

      <div
        className="focus-chart-tooltip"
        style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
        aria-hidden="true"
      >
        <span>{formatDate(active.createdAt)} · attempt {active.attemptNumber}</span>
        <strong>{activePercent}% accuracy</strong>
        <small>rolling {active.windowSize}-answer window</small>
      </div>
    </div>
  );
}
