'use client';

import { Star } from 'lucide-react';

import { setItemFavorite } from '@/actions/items';
import { Button } from '@/components/ui/button';
import { useFlagToggle } from '@/hooks/use-flag-toggle';
import { cn } from '@/lib/utils';

interface FavoriteItemButtonProps {
  itemId: string;
  /** Named in the label, so a screen reader hears which item is being starred. */
  title: string;
  isFavorite: boolean;
  className?: string;
}

/**
 * Favorites an item straight from its card, without opening the drawer.
 *
 * Shared by all four card shapes, which is what `ItemMarkers` used to be for:
 * that component now draws the pin alone, since a read-only star beside a star
 * toggle reads as two stars rather than as one piece of state.
 *
 * Deliberately not disabled while the write is in flight — the optimistic star
 * already shows what was asked for, and a star that greys out under the cursor
 * reads as a fault. Two clicks in flight at once settle on the later value
 * rather than cancelling out, which is why the action takes a value instead of
 * toggling the row.
 */
export function FavoriteItemButton({
  itemId,
  title,
  isFavorite: stored,
  className,
}: FavoriteItemButtonProps) {
  const { value: isFavorite, toggle } = useFlagToggle({
    id: itemId,
    value: stored,
    setValue: setItemFavorite,
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      // A toggle button rather than a label that changes under the user: the
      // pressed state is what a screen reader announces, and the name stays
      // the same thing it was before the click.
      aria-pressed={isFavorite}
      aria-label={`Favorite ${title}`}
      className={cn(
        // z-20 rather than a click handler that stops propagation: the card's
        // trigger is an `absolute inset-0` overlay at z-10, not a wrapper, so
        // there is no click to stop — the button simply has to sit above it.
        // The same mechanic `CopyItemButton` beside it uses.
        // 36px below `sm`, 28 above. The painted icon does not change; the
        // target does. Measured at 375px these sat 2px apart over a full-row
        // open button, which is a mis-tap waiting to happen — a pointer target
        // has to clear 24x24, and two of them this close want more.
        'relative z-20 size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-7',
        className
      )}
    >
      <Star className={cn('size-3.5', isFavorite && 'fill-yellow-500 text-yellow-500')} />
    </Button>
  );
}
