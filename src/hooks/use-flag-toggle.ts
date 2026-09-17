'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

/**
 * Either flag action — favorite or pin, item or collection. All of them take
 * the value to store rather than flipping the row, so one signature covers the
 * lot.
 */
type SetFlag = (
  id: string,
  value: boolean
) => Promise<{ success: true } | { success: false; error: string }>;

interface UseFlagToggleOptions {
  id: string;
  /** The stored value, as the server rendered it. */
  value: boolean;
  setValue: SetFlag;
  /**
   * Called with the new value once the write has landed, for a caller holding
   * client state the refresh below cannot reach — the drawer's own copy of the
   * item, which was set when it opened and is not re-rendered from the server.
   */
  onToggled?: (value: boolean) => void;
  /**
   * Toast to show once the write has landed. Omitted means no success toast,
   * which is what every star does: the star filling is its own confirmation,
   * and it appears on four card shapes at once, so a grid would stack them.
   *
   * The drawer's pin passes one, because neither of those holds there — it is
   * the only pin toggle on screen, and what pinning actually does happens
   * behind the open drawer, in a list the user cannot see.
   */
  successMessage?: (value: boolean) => string;
}

/**
 * An optimistic boolean toggle backed by a server action: the star wherever it
 * appears, and the pin in the item drawer.
 *
 * The value shown is optimistic, because a control that waits a round trip
 * before filling reads as a broken button rather than a slow one.
 * `useOptimistic` is given the prop rather than a local copy, so the confirmed
 * value arrives the ordinary way — the server re-renders the card — and the two
 * converge in one render with nothing to clear. A failed write needs no
 * rollback of its own for the same reason: the transition ends, the prop never
 * changed, and the control goes back to what it was.
 *
 * `router.refresh()` rather than anything narrower because these flags are read
 * in a lot of places — `/favorites`, the sidebar's Favorites group, the favorite
 * stat tiles, `/collections`' favorites-first ordering, the dashboard's Pinned
 * section and the pinned-first ordering on every listing — and `AppShell` is
 * `force-dynamic`, so one refresh reaches the layout as well as the page.
 *
 * A failure is always worth saying out loud, since the control snapping back is
 * otherwise unexplained.
 */
export function useFlagToggle({
  id,
  value,
  setValue,
  onToggled,
  successMessage,
}: UseFlagToggleOptions) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const router = useRouter();

  function toggle() {
    const next = !optimistic;

    // The setter is only allowed inside a transition — called outside one the
    // optimistic value reverts immediately, because there is no transition
    // holding it.
    startTransition(async () => {
      setOptimistic(next);

      const result = await setValue(id, next);

      if (!result.success) {
        toast.error(result.error);

        return;
      }

      if (successMessage) toast.success(successMessage(next));

      onToggled?.(next);
      router.refresh();
    });
  }

  return { value: optimistic, toggle };
}
