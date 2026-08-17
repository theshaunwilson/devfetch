import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  /** Optional leading icon, used by the Pinned and Recent sections */
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
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
        </Link>
      )}
    </div>
  );
}
