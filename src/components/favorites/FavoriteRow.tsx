import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { textColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FavoriteRowProps {
  icon: LucideIcon;
  /** Item type hex color; null falls back to the muted palette. */
  color: string | null;
  title: string;
  /** What kind of thing this row is — an item type name, or "Collection". */
  badge: string;
  /** ISO string, rendered as the row's date. */
  date: string;
  /**
   * The `absolute inset-0` control that makes the whole row clickable — a
   * button for an item, a link for a collection.
   */
  children: React.ReactNode;
}

/**
 * One line of the favorites list, shared by both sections so an item row and a
 * collection row line up icon for icon and date for date.
 *
 * Deliberately not a `Card`: the spec asks for a dense, terminal-style list, so
 * the only rule is the divider its `<ul>` draws between rows. The interactive
 * control arrives as a child rather than wrapping the row — a `<button>` takes
 * phrasing content only, which is the same reason `OpenItemButton` is an
 * overlay — and both sections use the overlay shape so focus and hover behave
 * identically whichever kind of row you are on.
 */
export function FavoriteRow({ icon: Icon, color, title, badge, date, children }: FavoriteRowProps) {
  return (
    <li className="relative flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50">
      {children}

      <Icon className={cn('size-4 shrink-0', textColorClass(color))} />

      <span className="min-w-0 flex-1 truncate">{title}</span>

      {/* The sidebar's `PRO` treatment: the default badge is a solid pill at
          `h-5`, far too loud on a row this dense. */}
      <Badge
        variant="outline"
        className="h-4 shrink-0 px-1.5 text-[10px] tracking-wider text-muted-foreground"
      >
        {badge}
      </Badge>

      {/* Fixed width and tabular figures so the dates form a column rather than
          ragging against the badges above and below them. */}
      <time
        dateTime={date}
        className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
      >
        {formatShortDate(date)}
      </time>
    </li>
  );
}
