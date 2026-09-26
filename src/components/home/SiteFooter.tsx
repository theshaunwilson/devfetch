import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { FOOTER_COLUMNS, SHELL } from '@/components/home/content';
import { cn } from '@/lib/utils';

interface SiteFooterProps {
  /** Resolved on the server, so the year is never a hydration mismatch. */
  year: number;
}

export function SiteFooter({ year }: SiteFooterProps) {
  return (
    <footer className="border-t border-border pt-14">
      <div className={cn(SHELL, 'grid grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]')}>
        <div>
          <Link
            href="#top"
            className="inline-flex items-center gap-2.5 rounded-lg text-[1.0625rem] font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <BrandMark />
            DevFetch
          </Link>
          <p className="mt-3 text-muted-foreground">Store smarter. Build faster.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-16 gap-y-8">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-2.5">
              <h3 className="font-medium">{column.heading}</h3>
              {column.entries.map((entry) => (
                <Link
                  key={entry.label}
                  href={entry.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div
        className={cn(
          SHELL,
          'flex flex-wrap justify-between gap-2 border-t border-border py-5.5 text-[0.8125rem] text-muted-foreground'
        )}
      >
        <small>&copy; {year} DevFetch</small>
        <small>Built for people who keep things.</small>
      </div>
    </footer>
  );
}
