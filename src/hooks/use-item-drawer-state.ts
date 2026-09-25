'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MAIN_CONTENT_ID } from '@/lib/constants';
import { focusReturnTarget, isAbortError, patchItem } from '@/lib/item-drawer';
import { fetchItemDetail } from '@/lib/item-detail-request';
import type { DashboardItem, ItemDetail, ItemDetailStatus, ItemDrawerMode } from '@/types/item';

/**
 * The item drawer's state and everything that changes it: opening on a card,
 * fetching the full item, and folding saves, deletes and flag toggles back in.
 *
 * `ItemDrawerProvider` holds one of these for the whole app and hands
 * `openItem` to every card through context.
 */
export function useItemDrawerState() {
  const [open, setOpen] = useState(false);
  // The card's own data, shown immediately so the drawer has a title and type
  // before the request comes back.
  const [item, setItem] = useState<DashboardItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [status, setStatus] = useState<ItemDetailStatus>('loading');
  const [mode, setMode] = useState<ItemDrawerMode>('view');

  const router = useRouter();

  const requestRef = useRef<AbortController | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Nothing should still be resolving into state after the shell unmounts.
  useEffect(() => () => requestRef.current?.abort(), []);

  const openItem = useCallback((next: DashboardItem, trigger: HTMLElement) => {
    // Clicking a second card while the first is still loading must not let the
    // slower response win.
    requestRef.current?.abort();
    triggerRef.current = trigger;

    const controller = new AbortController();
    requestRef.current = controller;

    setItem(next);
    setDetail(null);
    setStatus('loading');
    // Reset here rather than on close, where it would visibly flip the drawer
    // back to view mode partway through the slide-out.
    setMode('view');
    setOpen(true);

    void (async () => {
      try {
        setDetail(await fetchItemDetail(next.id, controller.signal));
        setStatus('loaded');
      } catch (error) {
        if (isAbortError(error)) return;

        console.error('Failed to load item detail:', error);
        setStatus('error');
      }
    })();
  }, []);

  /**
   * Takes the saved item as the new truth for both halves of the drawer's
   * state: `ItemDetail` is a superset of what a card holds, so the header and
   * the body both refresh from the one response, with no second fetch.
   */
  const onSaved = useCallback(
    (saved: ItemDetail) => {
      setItem(saved);
      setDetail(saved);
      setStatus('loaded');
      setMode('view');

      // The lists behind the drawer are server-rendered, so they keep the old
      // title and tags until their page re-renders.
      router.refresh();
    },
    [router],
  );

  /**
   * The item is gone, so there is nothing left to draw: close, and let the
   * lists behind catch up. `item` is deliberately left in place, as it is on
   * any other close, so the drawer still has something to show while it slides
   * out.
   */
  const onDeleted = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  /** See `patchItem`: both copies move, or edit mode is handed a stale item. */
  const onFavoriteChanged = useCallback((isFavorite: boolean) => {
    setItem((current) => patchItem(current, { isFavorite }));
    setDetail((current) => patchItem(current, { isFavorite }));
  }, []);

  /** As `onFavoriteChanged`, for the pin, and for the same reason. */
  const onPinChanged = useCallback((isPinned: boolean) => {
    setItem((current) => patchItem(current, { isPinned }));
    setDetail((current) => patchItem(current, { isPinned }));
  }, []);

  /**
   * Nothing opens the drawer declaratively, so Radix has no trigger to return
   * focus to — this does it explicitly, falling back to the main region when
   * the card that opened it has gone.
   */
  const onCloseAutoFocus = useCallback((event: Event) => {
    const target = focusReturnTarget(triggerRef.current, document.getElementById(MAIN_CONTENT_ID));

    if (!target) return;

    event.preventDefault();
    target.focus();
  }, []);

  return {
    open,
    setOpen,
    item,
    detail,
    status,
    mode,
    setMode,
    openItem,
    onSaved,
    onDeleted,
    onFavoriteChanged,
    onPinChanged,
    onCloseAutoFocus,
  };
}
