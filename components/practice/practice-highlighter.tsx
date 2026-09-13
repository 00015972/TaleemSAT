'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eraser, Highlighter } from 'lucide-react';

export type PracticeHighlightColor = 'yellow' | 'blue' | 'pink';
export type PracticeHighlights = Record<number, PracticeHighlightColor>;

type Token = { text: string; isWord: boolean };
type PalettePosition = { left: number; top: number };

const COLORS: Array<{ id: PracticeHighlightColor; label: string }> = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'blue', label: 'Blue' },
  { id: 'pink', label: 'Pink' },
];

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out.push({ text: match[0], isWord: /^[A-Za-z]/.test(match[0]) });
  }
  return out;
}

function selectionInside(selection: Selection, root: HTMLElement) {
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return !!anchor && !!focus && root.contains(anchor) && root.contains(focus);
}

export function PracticeHighlighter({
  text,
  highlights,
  onHighlightsChange,
  annotate,
}: {
  text: string;
  highlights: PracticeHighlights;
  onHighlightsChange: (next: PracticeHighlights) => void;
  annotate: boolean;
}) {
  const passageRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState<PracticeHighlightColor>('yellow');
  const [selectionIndices, setSelectionIndices] = useState<number[]>([]);
  const [palettePosition, setPalettePosition] = useState<PalettePosition | null>(null);
  const tokens = tokenize(text);

  const closePalette = useCallback(() => {
    setSelectionIndices([]);
    setPalettePosition(null);
  }, []);

  useEffect(() => {
    if (!annotate) {
      const timeout = window.setTimeout(closePalette, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [annotate, closePalette]);

  useEffect(() => {
    if (!palettePosition) return;
    const close = () => closePalette();
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [palettePosition, closePalette]);

  const readSelection = useCallback(() => {
    if (!annotate) return;
    const root = passageRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      closePalette();
      return;
    }
    if (!selectionInside(selection, root)) {
      closePalette();
      return;
    }

    const range = selection.getRangeAt(0);
    const indices = Array.from(root.querySelectorAll<HTMLElement>('[data-practice-word]'))
      .filter(node => range.intersectsNode(node))
      .map(node => Number(node.dataset.practiceWord))
      .filter(Number.isInteger);

    if (indices.length === 0) {
      closePalette();
      return;
    }

    const rect = range.getBoundingClientRect();
    const paletteWidth = 226;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - paletteWidth / 2),
      window.innerWidth - paletteWidth - 12
    );
    const top = Math.max(12, rect.top - 58);
    setSelectionIndices(indices);
    setPalettePosition({ left, top });
  }, [annotate, closePalette]);

  const applyTo = useCallback(
    (indices: number[], nextColor: PracticeHighlightColor | null) => {
      const next = { ...highlights };
      for (const index of indices) {
        if (nextColor) next[index] = nextColor;
        else delete next[index];
      }
      onHighlightsChange(next);
      if (nextColor) setColor(nextColor);
      window.getSelection()?.removeAllRanges();
      closePalette();
    },
    [highlights, onHighlightsChange, closePalette]
  );

  const toggleWord = useCallback(
    (index: number) => {
      if (!annotate) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      applyTo([index], highlights[index] === color ? null : color);
    },
    [annotate, applyTo, highlights, color]
  );

  let wordIndex = -1;

  return (
    <div className="prh-wrap">
      {annotate && (
        <div className="prh-colorbar" role="toolbar" aria-label="Highlight color">
          <span className="prh-colorbar-label">
            <Highlighter aria-hidden="true" /> Highlight color
          </span>
          {COLORS.map(item => (
            <ColorButton
              key={item.id}
              color={item.id}
              label={item.label}
              active={color === item.id}
              onClick={() => setColor(item.id)}
            />
          ))}
          <span className="prh-colorbar-hint">Select text or tap a word</span>
        </div>
      )}

      <div
        ref={passageRef}
        className={`prx-passage prh-passage${annotate ? ' is-annotating' : ''}`}
        onPointerUp={readSelection}
        onKeyUp={readSelection}
      >
        {tokens.map((token, tokenIndex) => {
          if (!token.isWord) return <span key={tokenIndex}>{token.text}</span>;
          const index = ++wordIndex;
          const marked = highlights[index];
          return (
            <span
              key={tokenIndex}
              data-practice-word={index}
              className={`prh-word${marked ? ` is-${marked}` : ''}`}
              onClick={() => toggleWord(index)}
            >
              {token.text}
            </span>
          );
        })}
      </div>

      {palettePosition &&
        createPortal(
          <div
            className="prh-floating ex-practice"
            role="toolbar"
            aria-label={`Highlight ${selectionIndices.length} selected word${selectionIndices.length === 1 ? '' : 's'}`}
            style={{ left: palettePosition.left, top: palettePosition.top }}
          >
            {COLORS.map(item => (
              <ColorButton
                key={item.id}
                color={item.id}
                label={`Highlight ${item.label.toLowerCase()}`}
                active={color === item.id}
                onClick={() => applyTo(selectionIndices, item.id)}
              />
            ))}
            <span className="prh-palette-divider" aria-hidden="true" />
            <button
              type="button"
              className="prh-erase"
              onClick={() => applyTo(selectionIndices, null)}
              aria-label="Erase highlight"
              title="Erase highlight"
            >
              <Eraser aria-hidden="true" />
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

function ColorButton({
  color,
  label,
  active,
  onClick,
}: {
  color: PracticeHighlightColor;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`prh-swatch is-${color}${active ? ' is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {active && <Check aria-hidden="true" />}
    </button>
  );
}
