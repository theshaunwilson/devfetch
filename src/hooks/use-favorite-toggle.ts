'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

/**
 * Either favorite action. Both take the value to store rather than flipping the
 * row, so one signature covers items and collections.
 */
type SetFavorite = (
  id: string,
  isFavorite: boolean
) => Promise<{ success: true } | { success: false; error: string }>;

interface UseFavoriteToggleOptions {
  id: string;
  /** The stored value, as the server rendered it. */
  isFavorite: boolean;
  setFavorite: SetFavorite;
  /**
   * Called with the new value once the write has landed, for a caller holding
   * client state the refresh below cannot reach — the drawer's own copy of the
   * item, which was set when it opened and is not re-rendered from the server.
   */
  onToggled?: (isFavorite: boolean) => void;
}

/**
 * The star, everywhere it appears: the item drawer, a collection's page, the
 * collection card menu and all four item card shapes.
 *
 * The value shown is optimistic, because a star that waits a round trip before
 * filling reads as a broken button rather than a slow one. `useOptimistic` is
 * given the prop rather than a local copy, so the confirmed value arrives the
 * ordinary way — the server re-renders the card — and the two converge in one
 * render with nothing to clear. A failed write needs no rollback of its own for
 * the same reason: the transition ends, the prop never changed, and the star
 * goes back to what it was.
 *
 * `router.refresh()` rather than anything narrower because the flag is read in
 * six places — `/favorites`, the sidebar's Favorites group, the two favorite
 * stat tiles, `/collections`' favorites-first ordering and the card itself — and
 * `AppShell` is `force-dynamic`, so one refresh reaches the layout as well as
 * the page.
 *
 * No toast on success: the star filling is its own confirmation, and a grid of
 * cards would stack them. A failure is worth saying out loud, since the star
 * snapping back is otherwise unexplained.
 */
export function useFavoriteToggle({
  id,
  isFavorite,
  setFavorite,
  onToggled,
}: UseFavoriteToggleOptions) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const router = useRouter();

  function toggle() {
    const next = !optimistic;

    // The setter is only allowed inside a transition — called outside one the
    // optimistic value reverts immediately, because there is no transition
    // holding it.
    startTransition(async () => {
      setOptimistic(next);

      const result = await setFavorite(id, next);

      if (!result.success) {
        toast.error(result.error);

        return;
      }

      onToggled?.(next);
      router.refresh();
    });
  }

  return { isFavorite: optimistic, toggle };
}
