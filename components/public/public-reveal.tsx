'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export function PublicReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    node.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          node.dataset.reveal = 'visible';
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -36px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`public-reveal ${className}`.trim()}
      style={{ '--public-reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
