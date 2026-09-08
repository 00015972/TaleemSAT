'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Info } from 'lucide-react';
import type { ReadinessPoint, ReadinessSnapshot } from '@/lib/analytics/readiness';

const WIDTH = 720;
const HEIGHT = 252;
const PLOT = { left: 42, right: 18, top: 24, bottom: 38 };

type ChartPoint = {
  x: number;
  y: number;
  point: ReadinessPoint;
  seriesIndex: number;
};

function smoothPath(points: ChartPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function factorLeader(current: ReadinessSnapshot) {
  const factors = [
    ['Accuracy', current.factors.accuracy / 50],
    ['Momentum', current.factors.momentum / 20],
    ['Coverage', current.factors.coverage / 20],
    ['Evidence', current.factors.evidence / 10],
  ] as const;
  return [...factors].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Evidence';
}

export function ReadinessTrajectory({
  series,
  current,
}: {
  series: ReadinessPoint[];
  current: ReadinessSnapshot;
}) {
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      series.flatMap((point, index) => {
        if (point.value === null) return [];
        return [{
          x: PLOT.left + (index / Math.max(1, series.length - 1)) * plotWidth,
          y: PLOT.top + (1 - point.value / 100) * plotHeight,
          point,
          seriesIndex: index,
        }];
      }),
    [plotHeight, plotWidth, series]
  );
  const [selectedIndex, setSelectedIndex] = useState(() =>
    chartPoints.at(-1)?.seriesIndex ?? 0
  );
  const selected = chartPoints.find(point => point.seriesIndex === selectedIndex) ?? chartPoints.at(-1);
  const linePath = smoothPath(chartPoints);
  const baseline = HEIGHT - PLOT.bottom;
  const areaPath = chartPoints.length > 1
    ? `${linePath} L ${chartPoints.at(-1)!.x} ${baseline} L ${chartPoints[0].x} ${baseline} Z`
    : '';
  const labelIndexes = [0, Math.floor((series.length - 1) / 2), series.length - 1];

  if (chartPoints.length === 0) {
    return (
      <div className="observatory-chart-empty">
        <span aria-hidden="true"><i /><i /><i /></span>
        <div>
          <strong>Your next answer starts the trajectory.</strong>
          <p>Fresh practice will rebuild a current readiness signal.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="observatory-chart-wrap">
        <svg
          className="observatory-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Thirty-day readiness trajectory. Current readiness ${current.value ?? 0} out of 100, ${current.confidence} confidence.`}
        >
          <defs>
            <linearGradient id="observatory-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--observatory-coral)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--observatory-coral)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[20, 60, 100].map(value => {
            const y = PLOT.top + (1 - value / 100) * plotHeight;
            return (
              <g key={value} className="observatory-chart-grid">
                <line x1={PLOT.left} y1={y} x2={WIDTH - PLOT.right} y2={y} />
                <text x={PLOT.left - 10} y={y + 3} textAnchor="end">{value}</text>
              </g>
            );
          })}

          <line
            className="observatory-chart-goal"
            x1={PLOT.left}
            x2={WIDTH - PLOT.right}
            y1={PLOT.top + plotHeight * 0.24}
            y2={PLOT.top + plotHeight * 0.24}
          />
          <text
            className="observatory-chart-goal-label"
            x={WIDTH - PLOT.right}
            y={PLOT.top + plotHeight * 0.24 - 8}
            textAnchor="end"
          >
            STRONG READINESS
          </text>

          {areaPath && <path className="observatory-chart-area" d={areaPath} />}
          <path className="observatory-chart-line" d={linePath} pathLength={1} />

          {chartPoints.map((chartPoint, index) => (
            <circle
              key={chartPoint.point.date}
              className="observatory-chart-point"
              cx={chartPoint.x}
              cy={chartPoint.y}
              r={selected?.seriesIndex === chartPoint.seriesIndex ? 7 : 4.5}
              tabIndex={0}
              role="button"
              aria-label={`${shortDate(chartPoint.point.date)}: readiness ${chartPoint.point.value}, ${chartPoint.point.attempts} attempts in the evidence window`}
              style={{ '--observatory-point-index': index } as CSSProperties}
              onFocus={() => setSelectedIndex(chartPoint.seriesIndex)}
              onMouseEnter={() => setSelectedIndex(chartPoint.seriesIndex)}
            />
          ))}

          {labelIndexes.map((index, labelIndex) => (
            <text
              key={index}
              className="observatory-chart-date"
              x={PLOT.left + (index / Math.max(1, series.length - 1)) * plotWidth}
              y={HEIGHT - 9}
              textAnchor={labelIndex === 0 ? 'start' : labelIndex === 2 ? 'end' : 'middle'}
            >
              {shortDate(series[index].date).toUpperCase()}
            </text>
          ))}
        </svg>

        {selected && (
          <div
            className={`observatory-chart-tooltip${selected.x > WIDTH * 0.73 ? ' is-right' : ''}`}
            style={{
              '--observatory-tip-x': `${(selected.x / WIDTH) * 100}%`,
              '--observatory-tip-y': `${(selected.y / HEIGHT) * 100}%`,
            } as CSSProperties}
            aria-live="polite"
          >
            <span>{shortDate(selected.point.date)}</span>
            <strong>{selected.point.value} readiness</strong>
            <small>{selected.point.attempts} answers · {selected.point.confidence} confidence</small>
          </div>
        )}
      </div>

      <details className="observatory-formula">
        <summary><Info size={14} aria-hidden="true" /> How readiness works</summary>
        <div className="observatory-formula-grid">
          <Factor label="Accuracy" value={current.factors.accuracy} max={50} />
          <Factor label="Momentum" value={current.factors.momentum} max={20} />
          <Factor label="Coverage" value={current.factors.coverage} max={20} />
          <Factor label="Evidence" value={current.factors.evidence} max={10} />
        </div>
        <p>
          A transparent readiness signal—not a predicted SAT score. Your strongest factor is currently {factorLeader(current).toLowerCase()}.
        </p>
      </details>
    </>
  );
}

function Factor({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="observatory-factor">
      <span>{label}</span>
      <strong>{Math.round(value)} / {max}</strong>
      <i><b style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></i>
    </div>
  );
}
