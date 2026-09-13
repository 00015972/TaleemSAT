'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * PostHog is loaded with a dynamic import rather than a top-level one.
 *
 * `posthog-js` is ~192 KB raw / 63 KB gzip — a quarter of the JavaScript the
 * static landing page used to ship, on a page whose only interactivity is a
 * scroll reveal. A static import put it in the entry chunk for every route,
 * so it downloaded and parsed before hydration on first paint, and it did so
 * even when NEXT_PUBLIC_POSTHOG_KEY was unset and the client was never
 * initialised. Importing inside the effect moves it into its own chunk that
 * the browser fetches after the page is interactive, and skips it entirely
 * when analytics is not configured.
 */

type PostHogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

export function Providers({ children }: { children: ReactNode }) {
  const [posthog, setPosthog] = useState<PostHogLike | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    let cancelled = false;

    void import('posthog-js').then(({ default: client }) => {
      if (cancelled) return;

      client.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
      });

      setPosthog(client);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView posthog={posthog} />
      </Suspense>
      {children}
    </>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary or it opts every route that
 * renders it out of static prerendering. Keeping it on this childless leaf
 * confines that to a component rendering null — the tree below Providers
 * still prerenders.
 */
function PostHogPageView({ posthog }: { posthog: PostHogLike | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog) return;
    const query = searchParams?.toString();
    posthog.capture('$pageview', {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams, posthog]);

  return null;
}
