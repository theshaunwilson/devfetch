'use client';

import { Copy, Pencil, Pin, Star } from 'lucide-react';

import { setItemFavorite } from '@/actions/items';
import { DeleteItemDialog } from '@/components/items/DeleteItemDialog';
import { Button } from '@/components/ui/button';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { cn } from '@/lib/utils';

interface ItemDrawerActionsProps {
  itemId: string;
  /** Named in the delete confirmation. */
  title: string;
  isFavorite: boolean;
  isPinned: boolean;
  onEdit: () => void;
  /** False until the full item has loaded — there is nothing to edit yet. */
  canEdit: boolean;
  /** Called once the item has been deleted. */
  onDeleted: () => void;
  /**
   * Called with the new value once the star has been written. The drawer's copy
   * of the item is client state set when it opened, so `router.refresh()` does
   * not reach it — without this the star would flip back the moment the write
   * landed.
   */
  onFavoriteChanged: (isFavorite: boolean) => void;
}

/**
 * The drawer's action bar.
 *
 * Edit, delete and favouriting are live. Pinning and copying still need
 * mutations that do not exist yet, so those two stay inert; their state still
 * renders, since it comes from the item itself.
 */
export function ItemDrawerActions({
  itemId,
  title,
  isFavorite,
  isPinned,
  onEdit,
  canEdit,
  onDeleted,
  onFavoriteChanged,
}: ItemDrawerActionsProps) {
  const favorite = useFavoriteToggle({
    id: itemId,
    isFavorite,
    setFavorite: setItemFavorite,
    onToggled: onFavoriteChanged,
  });

  return (
    // Wraps rather than overflows: buttons are `shrink-0`, so on a narrow
    // screen the bar would otherwise run past the drawer's edge.
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" onClick={favorite.toggle} aria-pressed={favorite.isFavorite}>
        <Star className={cn('size-4', favorite.isFavorite && 'fill-yellow-500 text-yellow-500')} />
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

      {/* One group, so the pair stays together when the bar wraps rather than
          Delete stranding alone on the second line. No auto margin: pushing
          the pair to the far right left a 102px hole beside Copy, which read
          as a layout fault rather than as grouping. */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={!canEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>

        {/* Not gated on `canEdit`: deleting needs only the id, which the card
            already carried in. */}
        <DeleteItemDialog itemId={itemId} title={title} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
