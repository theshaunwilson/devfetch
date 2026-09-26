import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Tailwind text color class for the icon */
  iconClassName?: string;
}

/** Single dashboard stat tile. */
export function StatCard({ label, value, icon: Icon, iconClassName }: StatCardProps) {
  return (
    // Tighter below `sm`, where the tiles sit two to a row at ~160px each: a
    // smaller icon and padding leave the label room, and it wraps to a second
    // line rather than truncating "Favorite Collections" to "Favorite C…".
    <Card className="flex-row items-center gap-2.5 px-3 sm:gap-3 sm:px-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted sm:size-10">
        <Icon className={cn('size-4 sm:size-5', iconClassName ?? 'text-muted-foreground')} />
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 text-sm leading-tight text-muted-foreground sm:truncate sm:leading-normal">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </div>
    </Card>
  );
}
