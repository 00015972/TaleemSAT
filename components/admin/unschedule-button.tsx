'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UnscheduleButton({ qodId }: { qodId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function remove() {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/qod/${qodId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-medium hover:underline"
        style={{ color: 'var(--err)' }}
      >
        Unschedule
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={remove}
        disabled={working}
        className="text-xs font-semibold disabled:opacity-50"
        style={{ color: 'var(--err)' }}
      >
        {working ? 'Removing…' : 'Confirm'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs text-muted hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
