'use client';

import { useEffect } from 'react';

export function TimezoneSync({ savedTimeZone }: { savedTimeZone: string }) {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === savedTimeZone) return;

    const controller = new AbortController();
    void fetch('/api/profile/timezone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: detected }),
      signal: controller.signal,
    }).catch(() => {
      // Timezone sync must never interrupt practice or navigation.
    });

    return () => controller.abort();
  }, [savedTimeZone]);

  return null;
}
