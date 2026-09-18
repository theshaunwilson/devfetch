import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

interface BrandProps {
  className?: string;
  /**
   * Where the mark links to. Left unset on the auth pages: they are reached
   * signed out, so a link to the dashboard would only bounce back to sign-in.
   */
  href?: string;
}

/** DevFetch mark and wordmark. The wordmark drops on the narrowest screens. */
export function Brand({ className, href }: BrandProps) {
  const content = (
    <>
      <BrandMark />
      {/*
        `sr-only` rather than `hidden` below `sm`: the mark itself is an
        unlabelled icon, so hiding the wordmark outright would leave this with
        no accessible name at all — and as a link, no name to announce.
      */}
      <span className="sr-only text-lg font-semibold tracking-tight sm:not-sr-only sm:inline">
        DevFetch
      </span>
    </>
  );

  const classes = cn('flex items-center gap-2.5', className);

  if (!href) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        classes,
        'rounded-lg transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
      )}
    >
      {content}
    </Link>
  );
}
