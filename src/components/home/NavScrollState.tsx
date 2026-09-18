'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NavScrollStateProps {
  children: ReactNode;
}

const SCROLLED_AFTER = 8;

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/**
 * The fixed header. It sits translucent over the hero and firms up into an
 * opaque bar with a bottom border once the page has moved at all.
 *
 * `useSyncExternalStore` rather than state set from an effect: the scroll
 * position is external state that already exists at mount — a page restored
 * part-way down should paint the scrolled bar rather than the transparent one
 * and then correct itself.
 */
export function NavScrollState({ children }: NavScrollStateProps) {
  const scrolled = useSyncExternalStore(
    subscribe,
    useCallback(() => window.scrollY > SCROLLED_AFTER, []),
    // The server has no scroll position; the top of the page is the honest
    // assumption and the one that matches a fresh load.
    useCallback(() => false, [])
  );

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-16 border-b backdrop-blur-md transition-colors duration-200',
        scrolled ? 'border-border bg-background/95' : 'border-transparent bg-background/60'
      )}
    >
      {children}
    </header>
  );
}
