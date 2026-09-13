/**
 * Renders a code-generated chart from a question's `chart_svg` column —
 * sanitized inline SVG (lib/import/svg-sanitize.ts), not a pasted image.
 *
 * The source SVGs bake in dark, print-style axis/label colors meant for a
 * light background, so the card stays a fixed light surface regardless of
 * the site's own theme — using a theme-following background here would make
 * the labels unreadable in dark mode.
 */
export function ChartFigure({ svg }: { svg: string | null | undefined }) {
  if (!svg) return null;

  return (
    <figure className="q-chart" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
