'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Calculator, RefreshCw, X } from 'lucide-react';

type DesmosInstance = {
  resize: () => void;
  destroy: () => void;
};

type DesmosApi = {
  GraphingCalculator: (
    element: HTMLElement,
    options?: Record<string, boolean | string | number>
  ) => DesmosInstance;
};

declare global {
  interface Window {
    Desmos?: DesmosApi;
  }
}

const DESMOS_SCRIPT_ID = 'taleem-desmos-api';
const DESMOS_API_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY;

let desmosLoader: Promise<DesmosApi> | null = null;

function loadDesmos(apiKey: string): Promise<DesmosApi> {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  if (desmosLoader) return desmosLoader;

  desmosLoader = new Promise<DesmosApi>((resolve, reject) => {
    const existing = document.getElementById(DESMOS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const finish = () => {
      if (window.Desmos) resolve(window.Desmos);
      else reject(new Error('Desmos API loaded without a calculator constructor.'));
    };
    const fail = () => {
      script.remove();
      reject(new Error('The Desmos API could not be loaded.'));
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });

    if (!existing) {
      script.id = DESMOS_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
      document.head.appendChild(script);
    }
  }).catch(error => {
    desmosLoader = null;
    throw error;
  });

  return desmosLoader;
}

export function PracticeDesmosPanel({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const calculatorHostRef = useRef<HTMLDivElement | null>(null);
  const calculatorRef = useRef<DesmosInstance | null>(null);
  const wasOpenRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>(
    DESMOS_API_KEY ? 'idle' : 'error'
  );
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      returnFocusRef?.current?.focus();
    }
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const host = calculatorHostRef.current;
    if (!open || !host || calculatorRef.current || !DESMOS_API_KEY) return;

    let cancelled = false;
    void loadDesmos(DESMOS_API_KEY)
      .then(Desmos => {
        if (cancelled || !calculatorHostRef.current) return;
        calculatorRef.current = Desmos.GraphingCalculator(calculatorHostRef.current, {
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          showResetButtonOnGraphpaper: true,
          expressionsTopbar: true,
          pointsOfInterest: true,
          trace: true,
          border: false,
        });
        calculatorRef.current.resize();
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open, retryNonce]);

  useEffect(() => {
    const host = calculatorHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (host.offsetWidth > 0 && host.offsetHeight > 0) calculatorRef.current?.resize();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open || !calculatorRef.current) return;
    const frame = requestAnimationFrame(() => calculatorRef.current?.resize());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    return () => {
      calculatorRef.current?.destroy();
      calculatorRef.current = null;
    };
  }, []);

  const visibleStatus = status === 'idle' ? 'loading' : status;

  return (
    <aside
      className="prcalc-panel"
      role="region"
      aria-label="Desmos graphing calculator"
      aria-hidden={!open}
      inert={!open}
      hidden={!open}
    >
      <header className="prcalc-head">
        <span><Calculator aria-hidden="true" /> Calculator</span>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close calculator">
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="prcalc-body">
        <div ref={calculatorHostRef} className="prcalc-host" aria-label="Desmos graphing calculator canvas" />
        {visibleStatus !== 'ready' && (
          <div className={`prcalc-status is-${visibleStatus}`} role={visibleStatus === 'error' ? 'alert' : 'status'}>
            {visibleStatus === 'loading' ? (
              <>
                <span className="prcalc-spinner" aria-hidden="true" />
                <strong>Loading Desmos…</strong>
                <p>The question remains available while the calculator starts.</p>
              </>
            ) : visibleStatus === 'error' ? (
              <>
                <strong>Calculator unavailable</strong>
                <p>Check the Desmos API key or your connection, then try again.</p>
                {DESMOS_API_KEY && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('idle');
                      setRetryNonce(value => value + 1);
                    }}
                  >
                    <RefreshCw aria-hidden="true" /> Try again
                  </button>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
