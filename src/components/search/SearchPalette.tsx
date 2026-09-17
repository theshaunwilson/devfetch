'use client';

import { defaultFilter } from 'cmdk';
import { Folder, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useItemDrawer } from '@/components/items/ItemDrawerProvider';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { textColorClass } from '@/lib/colors';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import {
  buildCollectionKeywords,
  buildItemKeywords,
  collapseWhitespace,
  isSearchShortcut,
  scoreKeywords,
} from '@/lib/search';
import { cn } from '@/lib/utils';
import type { CollectionOption } from '@/types/collection';
import type { SearchItem } from '@/types/search';

/**
 * Scores a row against its keywords rather than its `value`.
 *
 * cmdk identifies an item by `value` and it has to be unique, so it is the
 * row's id — which would otherwise be what gets searched, and a cuid matches
 * short queries by accident. The text worth searching rides in `keywords`.
 *
 * Each keyword is scored on its own and the best one wins, with anything weak
 * cut entirely: `scoreKeywords` carries the reasoning and the measurements.
 */
function filterByKeywords(value: string, search: string, keywords?: string[]): number {
  return scoreKeywords(keywords ?? [value], search, defaultFilter);
}

/** Nothing to subscribe to: the platform does not change under a mounted page. */
function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * The top bar's search field and the command palette behind it.
 *
 * One component rather than a trigger and a dialog wired through a provider:
 * the field is the only thing that opens the palette by click, so the open
 * state has nowhere else to be. Cmd+K works from anywhere through a document
 * listener.
 *
 * It sits inside `ItemDrawerProvider`, which `AppShell` mounts around the whole
 * shell for this reason — selecting an item opens the same drawer a card does.
 */
export function SearchPalette({
  items,
  collections,
}: {
  items: SearchItem[];
  collections: CollectionOption[];
}) {
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  // Set when a selection closes the palette, so the drawer that is opening can
  // keep the focus it is about to take.
  const handedOffRef = useRef(false);
  const router = useRouter();
  const { openItem } = useItemDrawer();

  // The server cannot know the platform, so the hint renders as ⌘ and is
  // corrected on the client. `useSyncExternalStore` rather than state set from
  // an effect, which is what it exists for — and what keeps hydration honest.
  const isMac = useSyncExternalStore(
    subscribeToNothing,
    () => /mac/i.test(navigator.userAgent),
    () => true,
  );

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

  const handleSelectItem = useCallback(
    (item: SearchItem) => {
      // Focus returns to the search field when the drawer closes, the way it
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

  const handleSelectCollection = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/collections/${id}`);
    },
    [router],
  );

  return (
    <>
      <div className="relative min-w-0 flex-1 sm:max-w-lg">
        <button
          ref={triggerRef}
          type="button"
          onClick={show}
          className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent py-1 pr-3 pl-2.5 text-left text-sm text-muted-foreground transition-colors outline-none hover:border-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:pr-16 dark:bg-input/30"
        >
          <Search className="size-4 shrink-0" />
          {/* Shortened twice over, both times because the row is not as wide
              as the wording wants. The fuller phrase truncated mid-word in the
              152px row this had at 390px; the top bar's favorites star then
              took 48px more, and the label needs 92px against the 64px the
              `sm:pr-16` hint already reserves. What actually binds is the
              header's width, which is the viewport less the open sidebar's
              256px — a container measurement no viewport breakpoint can see,
              so `lg` is where the field is wide enough with the sidebar open,
              and below it the label drops to the verb alone. With the sidebar
              collapsed there is room sooner and the short label simply shows
              anyway, which is harmless where a clipped one is not. The
              palette's own input says it in full, where there is always room. */}
          <span className="truncate">
            Search<span className="hidden lg:inline"> items...</span>
          </span>
        </button>
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          {isMac ? '⌘ K' : 'Ctrl K'}
        </kbd>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search your items and collections"
        className="sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          // Nothing opens this declaratively, so Radix has no trigger to return
          // focus to and leaves it on the body — a keyboard user would restart
          // from the top of the document. The drawer solves the same problem
          // the same way.
          if (handedOffRef.current) {
            handedOffRef.current = false;
            return;
          }

          const target = triggerRef.current ?? document.getElementById(MAIN_CONTENT_ID);

          if (!target) return;

          event.preventDefault();
          target.focus();
        }}
      >
        <Command filter={filterByKeywords} label="Search items and collections">
          {/* Uncontrolled: the dialog's content unmounts on close, so cmdk's
              own state is discarded with it and the next open starts empty.
              Mirroring the query into React state would only re-render every
              row on each keystroke for nothing. */}
          <CommandInput placeholder="Search items and collections..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {items.length > 0 && (
              <CommandGroup heading="Items">
                {items.map((item) => {
                  const Icon = getIcon(item.type.icon);
                  const preview = item.contentPreview
                    ? collapseWhitespace(item.contentPreview)
                    : null;

                  return (
                    <CommandItem
                      // The id, because cmdk needs a unique value per row. What
                      // the row is matched on is handed over as keywords.
                      key={item.id}
                      value={item.id}
                      keywords={buildItemKeywords(item)}
                      onSelect={() => handleSelectItem(item)}
                    >
                      <Icon className={cn('size-4', textColorClass(item.type.color))} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.title}</span>
                        {preview && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {preview}
                          </span>
                        )}
                      </span>
                      <CommandShortcut className="shrink-0">
                        {capitalize(item.type.name)}
                      </CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {collections.length > 0 && (
              <CommandGroup heading="Collections">
                {collections.map((collection) => (
                  <CommandItem
                    key={collection.id}
                    value={collection.id}
                    keywords={buildCollectionKeywords(collection)}
                    onSelect={() => handleSelectCollection(collection.id)}
                  >
                    <Folder className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                    <CommandShortcut className="shrink-0">
                      {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
