'use client';

import { Copy, Pencil, Pin, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ItemDrawerActionsProps {
  isFavorite: boolean;
  isPinned: boolean;
}

/**
 * The drawer's action bar.
 *
 * Layout only for now — favouriting, pinning, copying, editing and deleting all
 * need mutations that do not exist yet, so the buttons land together with them
 * rather than one working button sitting among four dead ones. The favourite
 * and pin states still render, since they come from the item itself.
 */
export function ItemDrawerActions({ isFavorite, isPinned }: ItemDrawerActionsProps) {
  return (
    // Wraps rather than overflows: buttons are `shrink-0`, so on a narrow
    // screen the bar would otherwise run past the drawer's edge.
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm">
        <Star className={cn('size-4', isFavorite && 'fill-yellow-500 text-yellow-500')} />
        Favorite
      </Button>

      <Button variant="ghost" size="sm">
        <Pin className={cn('size-4', isPinned && 'fill-current')} />
        Pin
      </Button>

      <Button variant="ghost" size="sm">
        <Copy className="size-4" />
        Copy
      </Button>

      {/* One group, so the pair stays together when the bar wraps and the
          auto margin only pushes them right while they share a line. */}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>

        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  );
}
