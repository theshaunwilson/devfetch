import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  /** Optional leading icon */
  icon?: LucideIcon;
  /** Renders a "View all" link on the right when set */
  viewAllHref?: string;
}

/** Title row above a dashboard section. */
export function SectionHeader({ title, icon: Icon, viewAllHref }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        {Icon && <Icon className="size-5 text-muted-foreground" />}
        {title}
      </h2>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          // The padding makes a 40px hit area out of a 20px line of text; the
          // matching negative margins keep the row exactly where it was.
          className="-my-2.5 -mr-2 shrink-0 rounded-md px-2 py-2.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          View all
        </Link>
      )}
    </div>
  );
}
