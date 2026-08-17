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
    <Card className="flex-row items-center gap-3 px-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className={cn('size-5', iconClassName ?? 'text-muted-foreground')} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </div>
    </Card>
  );
}
