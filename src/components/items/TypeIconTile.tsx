import type { LucideIcon } from 'lucide-react';
import { softBgColorClass, textColorClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface TypeIconTileProps {
  icon: LucideIcon;
  /** Item type hex color; null falls back to the muted palette. */
  color: string | null;
}

/** Tinted tile holding an item type icon. Shared by `ItemRow` and `ItemCard`. */
export function TypeIconTile({ icon: Icon, color }: TypeIconTileProps) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        softBgColorClass(color)
      )}
    >
      <Icon className={cn('size-4', textColorClass(color))} />
    </div>
  );
}
