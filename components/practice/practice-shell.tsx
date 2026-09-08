'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { PracticeBrowse, type PracticeScope } from '@/components/practice/practice-browse';
import type { PracticeBootstrap } from '@/components/practice/types';
import type { PracticeOverview } from '@/lib/practice/overview';

type Status = 'loading' | 'ready' | 'empty' | 'error';

const DynamicPracticeRunner = dynamic(
  () => import('@/components/practice/practice-runner').then(module => module.PracticeRunner),
  { ssr: false, loading: RunnerChunkLoading }
);

export function PracticeShell({
  overview,
  initialScope = null,
}: {
  overview: PracticeOverview;
  initialScope?: PracticeScope | null;
}) {
  const [scope, setScope] = useState<PracticeScope | null>(initialScope);
  const [status, setStatus] = useState<Status>('loading');
  const [bootstrap, setBootstrap] = useState<PracticeBootstrap | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  async function loadScope(target: PracticeScope) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    const scopeKey =
      target.kind === 'topic'
        ? 'topicSlug'
        : target.kind === 'category'
          ? 'categorySlug'
          : 'subjectSlug';
    const params = new URLSearchParams({ [scopeKey]: target.slug });
    if (target.difficulty !== 'all') params.set('difficulty', target.difficulty);

    try {
      const response = await fetch(`/api/practice/manifest?${params}`, {
        signal: controller.signal,
      });
      const data = (await response.json()) as Partial<PracticeBootstrap>;

      if (controller.signal.aborted) return;
      if (!response.ok) {
        setStatus(response.status === 404 ? 'empty' : 'error');
        return;
      }
      if (!Array.isArray(data.ids) || data.ids.length === 0 || !data.question) {
        setStatus('error');
        return;
      }

      setBootstrap(data as PracticeBootstrap);
      setStatus('ready');
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function startScope(target: PracticeScope) {
    setScope(target);
    setStatus('loading');
    setBootstrap(null);
    void loadScope(target);
  }

  useEffect(() => {
    const timer = initialScope
      ? window.setTimeout(() => void loadScope(initialScope), 0)
      : null;
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      activeRequest.current?.abort();
    };
    // initialScope is a server-validated mount-time instruction. The keyed
    // PracticeShell remounts when it changes, so this must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function backToTopics() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setScope(null);
    setBootstrap(null);
    setStatus('loading');
  }

  if (!scope) {
    return <PracticeBrowse overview={overview} onStart={startScope} />;
  }

  return (
    <DynamicPracticeRunner
      scope={scope}
      bootstrap={bootstrap}
      status={status}
      onExit={backToTopics}
    />
  );
}

function RunnerChunkLoading() {
  return (
    <div className="ex-root ex-practice" aria-busy="true" aria-label="Loading question set">
      <div />
      <div className="flex items-center justify-center p-6">
        <div className="prx-card flex w-full max-w-2xl animate-pulse flex-col gap-4">
          <div className="h-4 w-32 rounded" style={{ background: 'var(--border)' }} />
          <div className="h-20 rounded" style={{ background: 'var(--bg)' }} />
          <div className="h-5 w-3/4 rounded" style={{ background: 'var(--border)' }} />
        </div>
      </div>
      <div />
    </div>
  );
}
