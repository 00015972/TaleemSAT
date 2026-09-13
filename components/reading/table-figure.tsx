/**
 * Renders one sanitized `<table>` extracted from an HTML question-bank
 * import (lib/import/table-sanitize.ts) — real markup, not the flattened
 * "Row 1: Column: value" text the parser used to produce.
 */
export function TableFigure({ html }: { html: string | null | undefined }) {
  if (!html) return null;

  return <div className="q-table" dangerouslySetInnerHTML={{ __html: html }} />;
}
