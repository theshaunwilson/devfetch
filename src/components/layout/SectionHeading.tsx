import type { LucideIcon } from 'lucide-react';

interface SectionHeadingProps {
  icon: LucideIcon;
  title: string;
  count: number;
}

/**
 * Title row above a labelled group within a page, with the count it holds.
 *
 * Deliberately quieter than a page's own `h1` and than the dashboard's
 * `SectionHeader`: these label a group inside a larger view rather than
 * announce a new page, and at `text-xl font-semibold` they competed with the
 * heading above them. The treatment is the drawer's `SectionLabel` — the
 * pattern this codebase already uses for exactly that.
 *
 * Shared by `/collections/[id]`, where it started, and `/favorites`, rather
 * than copied: two labelled-section headings with a count would drift.
 */
export function SectionHeading({ icon: Icon, title, count }: SectionHeadingProps) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Icon className="size-4" />
      {title}
      <span className="text-xs">{count}</span>
    </h2>
  );
}
