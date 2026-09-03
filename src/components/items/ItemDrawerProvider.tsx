'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ItemDrawer } from '@/components/items/ItemDrawer';
import type { DashboardItem, ItemDetail, ItemDetailResponse } from '@/types/item';

/** What the drawer knows while its detail request is in flight. */
export type ItemDetailStatus = 'loading' | 'loaded' | 'error';

interface ItemDrawerContextValue {
  /**
   * `trigger` is the element that opened the drawer; focus returns to it on
   * close. Radix does that for itself when a `SheetTrigger` opens the sheet,
   * but nothing opens this one declaratively.
   */
  openItem: (item: DashboardItem, trigger: HTMLElement) => void;
}

const ItemDrawerContext = createContext<ItemDrawerContextValue | null>(null);

/**
 * Opens the item detail drawer.
 *
 * Only usable under `ItemDrawerProvider`, which `AppShell` mounts around every
 * signed-in page.
 */
export function useItemDrawer(): ItemDrawerContextValue {
  const context = useContext(ItemDrawerContext);

  if (!context) {
    throw new Error('useItemDrawer must be used within an ItemDrawerProvider');
  }

  return context;
}

/**
 * Holds the drawer's state and fetches the full item on click, so the pages
 * that render item cards can stay server components.
 *
 * One drawer for the whole app rather than one per list: the dashboard alone
 * renders two lists, which would otherwise each need their own state.
 */
export function ItemDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // The card's own data, shown immediately so the drawer has a title and type
  // before the request comes back.
  const [item, setItem] = useState<DashboardItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [status, setStatus] = useState<ItemDetailStatus>('loading');

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
    setOpen(true);

    void (async () => {
      try {
        const response = await fetch(`/api/items/${next.id}`, { signal: controller.signal });
        // A non-JSON body — an error page, say — rejects here and lands in the
        // catch below like any other failure.
        const body = (await response.json()) as ItemDetailResponse;

        if (!response.ok || !body.success) {
          throw new Error(body.success ? 'Could not load the item' : body.error);
        }

        setDetail(body.data);
        setStatus('loaded');
      } catch (error) {
        // An aborted request was replaced by a newer one, which owns the state
        // now.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.error('Failed to load item detail:', error);
        setStatus('error');
      }
    })();
  }, []);

  return (
    <ItemDrawerContext.Provider value={{ openItem }}>
      {children}
      <ItemDrawer
        open={open}
        // The item is deliberately left in place on close, so the drawer still
        // has something to draw through its slide-out animation.
        onOpenChange={setOpen}
        onCloseAutoFocus={(event) => {
          if (!triggerRef.current) return;

          // Without this the focus ring lands on the body and a keyboard user
          // loses their place in the list.
          event.preventDefault();
          triggerRef.current.focus();
        }}
        item={item}
        detail={detail}
        status={status}
      />
    </ItemDrawerContext.Provider>
  );
}
