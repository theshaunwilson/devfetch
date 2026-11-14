'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

/**
 * The DevFetch mark: a three-layer stack, drawn rather than sat in a filled
 * tile, so the only colour it shows is its own gradient.
 *
 * That gradient runs from `--primary` to `--brand-alt`, the palette's two
 * accents, so the mark introduces no colour the app does not already use. Each
 * stop takes its colour from a token utility through `currentColor` rather
 * than a hex literal; `src/app/icon.svg` copies the same two values.
 *
 * A client component only because of `useId`: up to three marks can render in
 * one document (desktop sidebar, mobile drawer, top bar), and an SVG gradient
 * id has to be unique per document or every instance resolves to the first.
 */
export function BrandMark({ className }: BrandMarkProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('block size-6.5 shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop className="text-primary [stop-color:currentColor]" />
          <stop offset="1" className="text-brand-alt [stop-color:currentColor]" />
        </linearGradient>
      </defs>
      <path
        d="M12 3 3 7.5 12 12l9-4.5L12 3Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m3 12 9 4.5 9-4.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m3 16.5 9 4.5 9-4.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
