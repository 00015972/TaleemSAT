'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteImportJobButton({
  jobId,
  filename,
  redirectTo,
}: {
  jobId: string;
  filename: string | null;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      `Remove "${filename ?? 'this import'}" from the import history? ` +
        `This only deletes the history record — it never touches questions already in the bank.`
    );
    if (!ok) return;

    setWorking(true);
    try {
      const res = await fetch(`/api/admin/import-jobs/${jobId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.detail ?? 'Could not delete this import.');
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={working}
      className="adm-btn secondary sm"
      style={{ color: 'var(--err)', borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)' }}
    >
      {working ? 'Deleting…' : 'Delete'}
    </button>
  );
}
