import { TableFigure } from './table-figure';

const TABLE_TOKEN = /^\[\[table:(\d+)\]\]$/;

/**
 * Renders a question's stem text — blocks joined by blank lines
 * (lib/import/html-questions.ts's flattenBody), with `[[table:N]]` tokens
 * swapped for the real, sanitized `<table>` markup they stand in for, so a
 * table renders where it appeared in the source instead of being flattened
 * into the surrounding prose.
 *
 * Each remaining block is sanitized HTML (lib/import/richtext-sanitize.ts) —
 * bold/italic/sup/sub and real MathML (`<math>`) for Math questions — set via
 * `dangerouslySetInnerHTML` rather than rendered as a plain-text child. A
 * block can itself be block-level (a numbered `<ol>` of statements), so each
 * one renders inside a `<div>`, not a `<p>` (a `<p>` can't legally contain an
 * `<ol>`).
 */
export function QuestionBody({
  text,
  tables,
  className,
}: {
  text: string;
  tables?: string[] | null;
  className?: string;
}) {
  const blocks = text.split('\n\n').filter(block => block.trim().length > 0);

  return (
    <div className={className ? `qbody ${className}` : 'qbody'}>
      {blocks.map((block, i) => {
        const match = block.trim().match(TABLE_TOKEN);
        if (match) {
          const html = tables?.[Number(match[1])];
          return html ? <TableFigure key={i} html={html} /> : null;
        }
        return <div key={i} className="qp" dangerouslySetInnerHTML={{ __html: block }} />;
      })}
    </div>
  );
}
