'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useItemDrawer } from '@/components/items/ItemDrawerProvider';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { isSearchShortcut } from '@/lib/search';
import type { SearchItem } from '@/types/search';

/**
 * The command palette's behaviour, apart from what it draws: whether it is
 * open, the Cmd+K toggle, what a selection does, and where focus goes when it
 * closes.
 *
 * Sits inside `ItemDrawerProvider`, which `AppShell` mounts around the whole
 * shell for this reason — selecting an item opens the same drawer a card does.
 */
export function useSearchPalette() {
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  // Set when a selection closes the palette, so the drawer that is opening can
  // keep the focus it is about to take.
  const handedOffRef = useRef(false);
  const router = useRouter();
  const { openItem } = useItemDrawer();

  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event)) return;

      // Monaco binds Cmd+K chords of its own, and the drawer and the create
      // dialog both render it. An editor that has the caret keeps the key.
      if (event.target instanceof Element && event.target.closest('.monaco-editor')) return;

      event.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    }

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectItem = useCallback(
    (item: SearchItem) => {
      // Focus returns to the search button when the drawer closes, the way it
      // returns to the card that opened it from a list. The main region is the
      // same fallback the drawer itself uses.
      const trigger = triggerRef.current ?? document.getElementById(MAIN_CONTENT_ID);

      // Set only once the drawer really is opening, or a close that opened
      // nothing would still suppress the focus restore.
      handedOffRef.current = trigger !== null;
      setOpen(false);

      if (!trigger) return;

      openItem(item, trigger);
    },
    [openItem],
  );

  const selectCollection = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/collections/${id}`);
    },
    [router],
  );

  /**
   * Nothing opens the palette declaratively, so Radix has no trigger to return
   * focus to and leaves it on the body — a keyboard user would restart from
   * the top of the document. The drawer solves the same problem the same way.
   */
  const restoreFocus = useCallback((event: Event) => {
    if (handedOffRef.current) {
      handedOffRef.current = false;
      return;
    }

    const target = triggerRef.current ?? document.getElementById(MAIN_CONTENT_ID);

    if (!target) return;

    event.preventDefault();
    target.focus();
  }, []);

  return { open, setOpen, show, triggerRef, selectItem, selectCollection, restoreFocus };
}
