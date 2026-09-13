'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

export type TurnstileWidgetHandle = {
  reset: () => void;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}>(function TurnstileWidget({ onVerify, onExpire }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    function render() {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
      });
    }

    if (window.turnstile) {
      render();
      return;
    }

    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        render();
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onExpire]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <div ref={containerRef} className="auth-turnstile" />
    </>
  );
});
