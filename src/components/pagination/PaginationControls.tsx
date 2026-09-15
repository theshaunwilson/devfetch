import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getPageNumbers } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import type { Pagination } from '@/types/pagination';

interface PaginationControlsProps {
  pagination: Pagination;
  /** Path the links point at. The page rides in `?page=`. */
  basePath: string;
}

/**
 * Numbered page links with a previous and a next step, under a paged list.
 *
 * A server component: every control is a link, so there is no state to hold and
 * nothing to hydrate. The links are left on Next's default `prefetch`, which
 * skips dynamic routes with no `loading.tsx` — all three paged pages are
 * `force-dynamic`, so a control sitting in the viewport does not speculatively
 * render up to seven pages against the database.
 *
 * A step with nowhere to go is a `<span>` rather than a disabled link: there is
 * no href to give it, and greying out something that still takes a click is
 * worse than not offering the click at all.
 */
export function PaginationControls({ pagination, basePath }: PaginationControlsProps) {
  const { page, totalPages, hasPreviousPage, hasNextPage } = pagination;

  // One page is not a choice.
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          <Step
            label="Previous"
            icon={ChevronLeft}
            href={hrefForPage(basePath, page - 1)}
            enabled={hasPreviousPage}
          />
        </li>

        {getPageNumbers(page, totalPages).map((link, index) =>
          link === 'ellipsis' ? (
            // Positional keys: the run this stands for is decided by where it
            // sits, and two ellipses never swap places.
            <li key={`ellipsis-${index}`} aria-hidden className={cn(CELL, 'text-muted-foreground')}>
              &hellip;
            </li>
          ) : (
            <li key={link}>
              <Link
                href={hrefForPage(basePath, link)}
                aria-label={`Page ${link}`}
                aria-current={link === page ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: link === page ? 'outline' : 'ghost' }),
                  CELL
                )}
              >
                {link}
              </Link>
            </li>
          )
        )}

        <li>
          <Step
            label="Next"
            icon={ChevronRight}
            href={hrefForPage(basePath, page + 1)}
            enabled={hasNextPage}
          />
        </li>
      </ul>
    </nav>
  );
}

/**
 * Every cell is the same height and at least as wide as it is tall, so a row of
 * single digits reads as a row of squares while a three-digit page still fits.
 */
const CELL = 'h-8 min-w-8 justify-center px-2';

interface StepProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  enabled: boolean;
}

function Step({ label, icon: Icon, href, enabled }: StepProps) {
  // The label names the step at every width, and is only drawn from `sm` up —
  // seven number cells and two labelled steps do not fit on a phone. It is text
  // rather than an `aria-label` because the disabled half is a plain `<span>`,
  // which takes no accessible name: an `aria-label` there is simply dropped,
  // and the two halves would then announce differently.
  const content = (
    <>
      <Icon className="size-4" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </>
  );

  if (!enabled) {
    return (
      <span
        aria-disabled
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          CELL,
          'text-muted-foreground opacity-50'
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(buttonVariants({ variant: 'ghost' }), CELL)}>
      {content}
    </Link>
  );
}

/** Page 1 is the bare path, so the first page has one canonical URL, not two. */
function hrefForPage(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}
