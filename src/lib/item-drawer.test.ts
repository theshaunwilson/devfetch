/**
 * The item drawer's small decisions. Each one guards a behaviour that was
 * verified by hand in the browser when it was built: a replaced request not
 * surfacing as an error, a toggled flag reaching both copies of the item, and
 * focus landing somewhere real after a delete.
 */
import { describe, expect, it } from 'vitest';

import { focusReturnTarget, isAbortError, patchItem } from './item-drawer';

describe('isAbortError', () => {
  it('recognises an aborted fetch', () => {
    expect(isAbortError(new DOMException('The operation was aborted.', 'AbortError'))).toBe(true);
  });

  it('does not mistake a real failure for an abort', () => {
    expect(isAbortError(new Error('Network down'))).toBe(false);
    expect(isAbortError(new DOMException('Timed out', 'TimeoutError'))).toBe(false);
  });

  it('does not mistake a plain object named AbortError for one', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(false);
  });
});

describe('patchItem', () => {
  it('applies the change to a copy and leaves the original untouched', () => {
    const original = { id: 'item_1', isFavorite: false, isPinned: true };

    const patched = patchItem(original, { isFavorite: true });

    expect(patched).toEqual({ id: 'item_1', isFavorite: true, isPinned: true });
    expect(original.isFavorite).toBe(false);
  });

  it('leaves an empty copy empty, so a detail still loading is not invented', () => {
    expect(patchItem<{ isFavorite: boolean }>(null, { isFavorite: true })).toBeNull();
  });
});

describe('focusReturnTarget', () => {
  const card = { isConnected: true };
  const main = { isConnected: true };

  it('returns focus to the card that opened the drawer', () => {
    expect(focusReturnTarget(card, main)).toBe(card);
  });

  it('falls back when that card has been removed, as it is after a delete', () => {
    expect(focusReturnTarget({ isConnected: false }, main)).toBe(main);
  });

  it('falls back when nothing opened the drawer', () => {
    expect(focusReturnTarget(null, main)).toBe(main);
  });

  it('returns nothing when there is nowhere to go', () => {
    expect(focusReturnTarget({ isConnected: false }, null)).toBeNull();
  });
});
