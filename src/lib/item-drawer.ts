/**
 * The item drawer's small decisions, pulled out of `useItemDrawerState` so
 * they can be tested without a DOM or a React tree.
 */

/**
 * Whether a failed detail request was aborted rather than broken.
 *
 * Opening a second card while the first is still loading aborts the first
 * request, and that abort must not surface as an error — the newer request
 * owns the drawer now. `fetchItemDetail` lets an `AbortError` through
 * untouched for exactly this check.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Applies a change to one of the drawer's copies of the item, leaving an empty
 * copy empty.
 *
 * The drawer holds the card's item and the fetched detail as client state, so
 * a favorite or pin written from inside it has to move both — the
 * `router.refresh()` the toggle issues re-renders the lists behind the drawer,
 * not the drawer itself.
 */
export function patchItem<T extends object>(current: T | null, patch: Partial<T>): T | null {
  return current ? { ...current, ...patch } : current;
}

/**
 * Where focus goes when the drawer closes: back to the element that opened
 * it, or the fallback when that element has gone.
 *
 * After a delete the card that opened the drawer no longer exists, and
 * focusing a detached node silently does nothing — left to itself the focus
 * ring lands on the body and a keyboard user restarts from the top.
 */
export function focusReturnTarget<T extends { isConnected: boolean }>(
  trigger: T | null,
  fallback: T | null,
): T | null {
  return trigger?.isConnected === true ? trigger : fallback;
}
