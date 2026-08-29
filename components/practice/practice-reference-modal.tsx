'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

export function PracticeReferenceModal({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      wasOpenRef.current = true;
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[data-reference-close]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return;
    wasOpenRef.current = false;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className="prref-dialog"
      aria-labelledby="prref-title"
      onCancel={event => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={event => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="prref-shell">
        <header className="prref-head">
          <div>
            <p>Math tools</p>
            <h2 id="prref-title">Reference</h2>
          </div>
          <button
            type="button"
            className="prref-icon-close"
            data-reference-close
            onClick={() => onOpenChange(false)}
            aria-label="Close reference"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="prref-grid">
          <FormulaCard title="Circle" figure={<CircleFigure />}>
            <p><i>A</i> = π<i>r</i><sup>2</sup></p>
            <p><i>C</i> = 2π<i>r</i></p>
          </FormulaCard>
          <FormulaCard title="Rectangle" figure={<RectangleFigure />}>
            <p><i>A</i> = ℓ<i>w</i></p>
          </FormulaCard>
          <FormulaCard title="Triangle" figure={<TriangleFigure />}>
            <p><i>A</i> = <span className="prref-frac"><span>1</span><span>2</span></span><i>bh</i></p>
          </FormulaCard>
          <FormulaCard title="Right triangle" figure={<RightTriangleFigure />}>
            <p><i>c</i><sup>2</sup> = <i>a</i><sup>2</sup> + <i>b</i><sup>2</sup></p>
          </FormulaCard>
          <FormulaCard title="Special right triangles" figure={<SpecialTrianglesFigure />} wide>
            <p className="prref-small-formula">30°–60°–90° and 45°–45°–90°</p>
          </FormulaCard>
          <FormulaCard title="Rectangular prism" figure={<PrismFigure />}>
            <p><i>V</i> = ℓ<i>wh</i></p>
          </FormulaCard>
          <FormulaCard title="Cylinder" figure={<CylinderFigure />}>
            <p><i>V</i> = π<i>r</i><sup>2</sup><i>h</i></p>
          </FormulaCard>
          <FormulaCard title="Sphere" figure={<SphereFigure />}>
            <p><i>V</i> = <span className="prref-frac"><span>4</span><span>3</span></span>π<i>r</i><sup>3</sup></p>
          </FormulaCard>
          <FormulaCard title="Cone" figure={<ConeFigure />}>
            <p><i>V</i> = <span className="prref-frac"><span>1</span><span>3</span></span>π<i>r</i><sup>2</sup><i>h</i></p>
          </FormulaCard>
          <FormulaCard title="Pyramid" figure={<PyramidFigure />}>
            <p><i>V</i> = <span className="prref-frac"><span>1</span><span>3</span></span>ℓ<i>wh</i></p>
          </FormulaCard>
        </div>

        <section className="prref-facts" aria-label="Angle and circle facts">
          <p>The number of degrees of arc in a circle is 360.</p>
          <p>The number of radians of arc in a circle is 2π.</p>
          <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>
        </section>

        <footer className="prref-foot">
          <button type="button" onClick={() => onOpenChange(false)}>Close</button>
        </footer>
      </div>
    </dialog>
  );
}

function FormulaCard({
  title,
  figure,
  children,
  wide = false,
}: {
  title: string;
  figure: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`prref-card${wide ? ' is-wide' : ''}`}>
      <h3>{title}</h3>
      <div className="prref-figure" aria-hidden="true">{figure}</div>
      <div className="prref-formula">{children}</div>
    </article>
  );
}

function CircleFigure() {
  return <svg viewBox="0 0 180 120"><circle cx="80" cy="58" r="42" /><path d="M80 58h42" /><circle cx="80" cy="58" r="2.5" className="fill" /><text x="99" y="52">r</text></svg>;
}
function RectangleFigure() {
  return <svg viewBox="0 0 180 120"><rect x="25" y="28" width="126" height="66" /><text x="84" y="22">ℓ</text><text x="156" y="66">w</text></svg>;
}
function TriangleFigure() {
  return <svg viewBox="0 0 180 120"><path d="M20 96 90 20l70 76Z" /><path d="M90 20v76" className="dash" /><text x="94" y="62">h</text><text x="86" y="114">b</text></svg>;
}
function RightTriangleFigure() {
  return <svg viewBox="0 0 180 120"><path d="M28 98V18l130 80Z" /><path d="M28 84h14v14" /><text x="16" y="61">b</text><text x="92" y="114">a</text><text x="102" y="51">c</text></svg>;
}
function SpecialTrianglesFigure() {
  return <svg viewBox="0 0 360 120"><path d="M14 96 154 22v74Z" /><path d="M154 82h-14v14" /><text x="53" y="88">30°</text><text x="118" y="48">2x</text><text x="132" y="112">x√3</text><text x="158" y="67">x</text><path d="M208 96V22l132 74Z" /><path d="M208 82h14v14" /><text x="218" y="51">45°</text><text x="280" y="88">45°</text><text x="198" y="67">s</text><text x="270" y="112">s</text><text x="279" y="48">s√2</text></svg>;
}
function PrismFigure() {
  return <svg viewBox="0 0 180 120"><path d="M22 46h100v58H22Z M22 46l24-22h104l-28 22M122 46l28-22v58l-28 22" /><text x="66" y="117">ℓ</text><text x="138" y="106">w</text><text x="154" y="69">h</text></svg>;
}
function CylinderFigure() {
  return <svg viewBox="0 0 180 120"><ellipse cx="87" cy="24" rx="48" ry="16" /><path d="M39 24v72M135 24v72M39 96c0 21 96 21 96 0M39 96c0-21 96-21 96 0" className="mixed" /><path d="M87 24h48" /><text x="111" y="19">r</text><text x="143" y="65">h</text></svg>;
}
function SphereFigure() {
  return <svg viewBox="0 0 180 120"><circle cx="88" cy="60" r="50" /><ellipse cx="88" cy="60" rx="50" ry="16" className="mixed" /><path d="M88 60h50" /><circle cx="88" cy="60" r="2.5" className="fill" /><text x="115" y="54">r</text></svg>;
}
function ConeFigure() {
  return <svg viewBox="0 0 180 120"><path d="M88 10 32 94M88 10l56 84M32 94c0 22 112 22 112 0M32 94c0-22 112-22 112 0" className="mixed" /><path d="M88 10v84M88 94h56" className="dash" /><text x="94" y="57">h</text><text x="116" y="89">r</text></svg>;
}
function PyramidFigure() {
  return <svg viewBox="0 0 180 120"><path d="M84 10 20 94l72 14 68-39ZM84 10l8 98M20 94l140-25M84 10l76 59" /><path d="M84 10v82" className="dash" /><text x="92" y="56">h</text><text x="46" y="112">ℓ</text><text x="142" y="102">w</text></svg>;
}
