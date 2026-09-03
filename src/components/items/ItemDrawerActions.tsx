'use client';

import { Copy, Pencil, Pin, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ItemDrawerActionsProps {
  isFavorite: boolean;
  isPinned: boolean;
  onEdit: () => void;
  /** False until the full item has loaded — there is nothing to edit yet. */
  canEdit: boolean;
}

/**
 * The drawer's action bar.
 *
 * Edit is live. Favouriting, pinning, copying and deleting still need mutations
 * that do not exist yet, so those four stay inert; their state still renders,
 * since it comes from the item itself.
 */
export function ItemDrawerActions({
  isFavorite,
  isPinned,
  onEdit,
  canEdit,
}: ItemDrawerActionsProps) {
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
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={!canEdit}>
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
