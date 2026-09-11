'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ItemDrawer } from '@/components/items/ItemDrawer';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { fetchItemDetail } from '@/lib/item-detail-request';
import type { CollectionOption } from '@/types/collection';
import type { DashboardItem, ItemDetail } from '@/types/item';

/** What the drawer knows while its detail request is in flight. */
export type ItemDetailStatus = 'loading' | 'loaded' | 'error';

/** Reading the item, or editing it in place. */
export type ItemDrawerMode = 'view' | 'edit';

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
export function ItemDrawerProvider({
  children,
  collectionOptions,
}: {
  children: React.ReactNode;
  /**
   * Every collection the user owns, for edit mode's picker. A prop rather than
   * part of the detail request: the same list is already loaded on the server
   * for the top bar's create dialog, so this costs no second query — and the
   * picker is populated before the detail request resolves.
   */
  collectionOptions: CollectionOption[];
}) {
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

  /**
   * Takes the saved item as the new truth for both halves of the drawer's
   * state: `ItemDetail` is a superset of what a card holds, so the header and
   * the body both refresh from the one response, with no second fetch.
   */
  const handleSaved = useCallback(
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
  const handleDeleted = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  // Memoized, or every drawer transition — open, fetch resolve, edit toggle,
  // close — would change the context identity and re-render every
  // OpenItemButton on the page. There is one per card and the lists are
  // unpaginated, so the count is unbounded. `openItem` is already stable.
  const value = useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDrawerContext.Provider value={value}>
      {children}
      <ItemDrawer
        open={open}
        // The item is deliberately left in place on close, so the drawer still
        // has something to draw through its slide-out animation.
        onOpenChange={setOpen}
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;

          // After a delete the card that opened the drawer no longer exists,
          // and focusing a detached node silently does nothing — so fall back
          // to the main region. Either way this has to be explicit: left to
          // itself the focus ring lands on the body and a keyboard user
          // restarts from the top of the document.
          const target =
            trigger?.isConnected === true ? trigger : document.getElementById(MAIN_CONTENT_ID);

          if (!target) return;

          event.preventDefault();
          target.focus();
        }}
        item={item}
        detail={detail}
        collectionOptions={collectionOptions}
        status={status}
        mode={mode}
        onModeChange={setMode}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </ItemDrawerContext.Provider>
  );
}
