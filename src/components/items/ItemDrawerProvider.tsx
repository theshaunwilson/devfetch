'use client';

import { createContext, useContext, useMemo } from 'react';

import { ItemDrawer } from '@/components/items/ItemDrawer';
import { useItemDrawerState } from '@/hooks/use-item-drawer-state';
import type { CollectionOption } from '@/types/collection';
import type { DashboardItem } from '@/types/item';

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
 * that render item cards can stay server components. The state and its
 * handlers live in `useItemDrawerState`.
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
  const drawer = useItemDrawerState();
  const { openItem } = drawer;

  // Memoized, or every drawer transition — open, fetch resolve, edit toggle,
  // close — would change the context identity and re-render every
  // OpenItemButton on the page. There is one per card and the lists are
  // unpaginated, so the count is unbounded. `openItem` is already stable.
  const value = useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDrawerContext.Provider value={value}>
      {children}
      <ItemDrawer
        open={drawer.open}
        // The item is deliberately left in place on close, so the drawer still
        // has something to draw through its slide-out animation.
        onOpenChange={drawer.setOpen}
        onCloseAutoFocus={drawer.onCloseAutoFocus}
        item={drawer.item}
        detail={drawer.detail}
        collectionOptions={collectionOptions}
        status={drawer.status}
        mode={drawer.mode}
        onModeChange={drawer.setMode}
        onSaved={drawer.onSaved}
        onDeleted={drawer.onDeleted}
        onFavoriteChanged={drawer.onFavoriteChanged}
        onPinChanged={drawer.onPinChanged}
      />
    </ItemDrawerContext.Provider>
  );
}
