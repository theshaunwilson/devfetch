'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Fades its children in the first time they scroll into view, then stops
 * observing — a section only arrives once.
 *
 * Reduced motion is honoured in CSS rather than in JavaScript: the hidden and
 * transitioned states are all `motion-safe:` utilities, so under
 * `prefers-reduced-motion: reduce` none of them apply and the content is
 * simply visible from the first paint, with no state to set and no flash.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'motion-safe:translate-y-4 motion-safe:opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out',
        visible && 'motion-safe:translate-y-0 motion-safe:opacity-100',
        className
      )}
    >
      {children}
    </div>
  );
}
