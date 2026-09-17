'use client';

import { Copy, Pencil, Pin, Star } from 'lucide-react';

import { setItemFavorite, setItemPinned } from '@/actions/items';
import { DeleteItemDialog } from '@/components/items/DeleteItemDialog';
import { Button } from '@/components/ui/button';
import { useFlagToggle } from '@/hooks/use-flag-toggle';
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
  /** As `onFavoriteChanged`, for the pin, and needed for the same reason. */
  onPinChanged: (isPinned: boolean) => void;
}

/**
 * The drawer's action bar.
 *
 * Edit, delete, favouriting and pinning are live. Copying still needs a
 * mutation that does not exist yet, so that one stays inert.
 *
 * The pin toasts and the star does not, which is deliberate rather than an
 * inconsistency. The star appears on every card, where a confirmation per click
 * would stack, and it fills in a list the user is already looking at. The pin
 * exists only here, and what it does — sorting the item to the top of its
 * listings and into the dashboard's Pinned section — happens behind the open
 * drawer, out of sight.
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
  onPinChanged,
}: ItemDrawerActionsProps) {
  const favorite = useFlagToggle({
    id: itemId,
    value: isFavorite,
    setValue: setItemFavorite,
    onToggled: onFavoriteChanged,
  });

  const pin = useFlagToggle({
    id: itemId,
    value: isPinned,
    setValue: setItemPinned,
    onToggled: onPinChanged,
    successMessage: (pinned) => (pinned ? 'Item pinned' : 'Item unpinned'),
  });

  return (
    // Wraps rather than overflows: buttons are `shrink-0`, so on a narrow
    // screen the bar would otherwise run past the drawer's edge.
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" onClick={favorite.toggle} aria-pressed={favorite.value}>
        <Star className={cn('size-4', favorite.value && 'fill-yellow-500 text-yellow-500')} />
        Favorite
      </Button>

      {/* A stable name with a pressed state rather than a label flipping
          between Pin and Unpin, matching the star beside it: the name says what
          the button is, `aria-pressed` says which way it currently sits. */}
      <Button variant="ghost" size="sm" onClick={pin.toggle} aria-pressed={pin.value}>
        <Pin className={cn('size-4', pin.value && 'fill-current')} />
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
