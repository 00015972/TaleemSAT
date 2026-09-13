'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Eraser, Highlighter } from 'lucide-react';
import {
  updatePracticeHighlights,
  type PracticeHighlightColor,
  type PracticeHighlightRegion,
  type PracticeHighlights,
  type PracticeHighlightTarget,
} from '@/lib/practice/highlights';

export type { PracticeHighlights } from '@/lib/practice/highlights';

type PalettePosition = { left: number; top: number };

const COLORS: Array<{ id: PracticeHighlightColor; label: string }> = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'blue', label: 'Blue' },
  { id: 'pink', label: 'Pink' },
];

const WORD_PATTERN = /[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}'’.-]*[\p{L}\p{M}\p{N}])?/gu;
const SKIPPED_CONTENT =
  '[data-practice-word], math, svg, table, button, input, textarea, select, option, code, pre';

function isHighlightRegion(value: string | undefined): value is PracticeHighlightRegion {
  return value === 'passage' || value === 'stem';
}

function unwrapWords(regionElement: HTMLElement) {
  for (const word of regionElement.querySelectorAll<HTMLElement>('[data-practice-word]')) {
    word.replaceWith(document.createTextNode(word.textContent ?? ''));
  }
  regionElement.normalize();
}

function decorateRegion(regionElement: HTMLElement, region: PracticeHighlightRegion) {
  unwrapWords(regionElement);

  const walker = document.createTreeWalker(regionElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIPPED_CONTENT)) return NodeFilter.FILTER_REJECT;
      return /[\p{L}\p{N}]/u.test(node.nodeValue ?? '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const textNodes: Text[] = [];
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) textNodes.push(textNode as Text);

  let wordIndex = 0;
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    WORD_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = WORD_PATTERN.exec(node.data)) !== null) {
      if (match.index > cursor) fragment.append(node.data.slice(cursor, match.index));

      const word = document.createElement('span');
      word.className = 'prh-word';
      word.dataset.practiceRegion = region;
      word.dataset.practiceWord = String(wordIndex++);
      word.textContent = match[0];
      fragment.append(word);
      cursor = match.index + match[0].length;
    }

    if (cursor < node.data.length) fragment.append(node.data.slice(cursor));
    node.replaceWith(fragment);
  }
}

function paintHighlights(root: HTMLElement, highlights: PracticeHighlights) {
  for (const word of root.querySelectorAll<HTMLElement>('[data-practice-word]')) {
    const region = word.dataset.practiceRegion;
    const index = Number(word.dataset.practiceWord);
    const marked = isHighlightRegion(region) && Number.isInteger(index)
      ? highlights[region]?.[index]
      : undefined;

    word.classList.toggle('is-yellow', marked === 'yellow');
    word.classList.toggle('is-blue', marked === 'blue');
    word.classList.toggle('is-pink', marked === 'pink');
  }
}

function selectionInside(selection: Selection, root: HTMLElement) {
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return !!anchor && !!focus && root.contains(anchor) && root.contains(focus);
}

export function PracticeHighlighter({
  contentKey,
  passage,
  highlights,
  onHighlightsChange,
  annotate,
  children,
}: {
  contentKey: string;
  passage: string | null;
  highlights: PracticeHighlights;
  onHighlightsChange: (next: PracticeHighlights) => void;
  annotate: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState<PracticeHighlightColor>('yellow');
  const [selectionTargets, setSelectionTargets] = useState<PracticeHighlightTarget[]>([]);
  const [palettePosition, setPalettePosition] = useState<PalettePosition | null>(null);

  const closePalette = useCallback(() => {
    setSelectionTargets([]);
    setPalettePosition(null);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    for (const regionElement of root.querySelectorAll<HTMLElement>(
      '[data-practice-highlight-region]'
    )) {
      const region = regionElement.dataset.practiceHighlightRegion;
      if (isHighlightRegion(region)) decorateRegion(regionElement, region);
    }
  }, [contentKey]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root) paintHighlights(root, highlights);
  }, [contentKey, highlights]);

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
    const root = rootRef.current;
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
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('[data-practice-word][data-practice-region]')
    ).flatMap(word => {
      const region = word.dataset.practiceRegion;
      const index = Number(word.dataset.practiceWord);
      if (!isHighlightRegion(region) || !Number.isInteger(index)) return [];
      try {
        return range.intersectsNode(word) ? [{ region, index }] : [];
      } catch {
        return [];
      }
    });

    if (targets.length === 0) {
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
    setSelectionTargets(targets);
    setPalettePosition({ left, top });
  }, [annotate, closePalette]);

  const applyTo = useCallback(
    (targets: PracticeHighlightTarget[], nextColor: PracticeHighlightColor | null) => {
      onHighlightsChange(updatePracticeHighlights(highlights, targets, nextColor));
      if (nextColor) setColor(nextColor);
      window.getSelection()?.removeAllRanges();
      closePalette();
    },
    [highlights, onHighlightsChange, closePalette]
  );

  const toggleWord = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!annotate) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (!(event.target instanceof Element)) return;

      const word = event.target.closest<HTMLElement>(
        '[data-practice-word][data-practice-region]'
      );
      const region = word?.dataset.practiceRegion;
      const index = Number(word?.dataset.practiceWord);
      if (!word || !isHighlightRegion(region) || !Number.isInteger(index)) return;

      const target = { region, index };
      applyTo([target], highlights[region]?.[index] === color ? null : color);
    },
    [annotate, applyTo, highlights, color]
  );

  const regionEvents = {
    onPointerUp: readSelection,
    onKeyUp: readSelection,
    onClick: toggleWord,
  };

  return (
    <div
      ref={rootRef}
      className={`prh-wrap${passage ? ' has-passage' : ''}${annotate ? ' is-annotating' : ''}`}
    >
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

      {passage && (
        <div
          className="prx-passage prh-passage"
          data-practice-highlight-region="passage"
          {...regionEvents}
        >
          {passage}
        </div>
      )}

      <div
        className="prh-stem"
        data-practice-highlight-region="stem"
        {...regionEvents}
      >
        {children}
      </div>

      {palettePosition &&
        createPortal(
          <div
            className="prh-floating ex-practice"
            role="toolbar"
            aria-label={`Highlight ${selectionTargets.length} selected word${selectionTargets.length === 1 ? '' : 's'}`}
            style={{ left: palettePosition.left, top: palettePosition.top }}
          >
            {COLORS.map(item => (
              <ColorButton
                key={item.id}
                color={item.id}
                label={`Highlight ${item.label.toLowerCase()}`}
                active={color === item.id}
                onClick={() => applyTo(selectionTargets, item.id)}
              />
            ))}
            <span className="prh-palette-divider" aria-hidden="true" />
            <button
              type="button"
              className="prh-erase"
              onClick={() => applyTo(selectionTargets, null)}
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
