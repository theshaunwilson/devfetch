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

/** Nothing to subscribe to: the platform does not change under a mounted page. */
function subscribeToNothing(): () => void {
  return () => {};
}

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

/**
 * The top bar's search button and the command palette behind it.
 *
 * One component rather than a trigger and a dialog wired through a provider:
 * the button is the only thing that opens the palette by click, so the open
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

  const handleSelectCollection = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/collections/${id}`);
    },
    [router],
  );

  return (
    <>
      {/*
        One trigger in two shapes: an icon button on a narrow screen, the
        labelled field from `lg` up.

        One element rather than two, because `triggerRef` has to name whichever
        is on screen — focus returns here when the palette or the drawer closes,
        and a ref split across a hidden twin would return it to a `display:
        none` element.

        `lg` is where the field is wide enough, and that threshold is inherited
        rather than guessed: what binds is the header's width, which is the
        viewport less the open sidebar's 256px, so the label had already been
        cut twice at `md` before the field was dropped for an icon.
      */}
      <div className="relative shrink-0 lg:min-w-0 lg:flex-1 lg:shrink lg:basis-0 lg:max-w-lg">
        <button
          ref={triggerRef}
          type="button"
          onClick={show}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none',
            'hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
            // From `lg` it stops being a button-shaped icon and becomes the
            // field: full width, bordered, left-aligned, with room at the
            // right for the shortcut hint sitting over it.
            'lg:w-full lg:justify-start lg:gap-2 lg:border lg:border-input lg:bg-transparent lg:py-1 lg:pr-16 lg:pl-2.5 lg:text-left lg:text-sm',
            'lg:hover:border-ring/50 lg:hover:bg-transparent lg:hover:text-muted-foreground lg:focus-visible:border-ring',
            'lg:dark:bg-input/30'
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="sr-only lg:not-sr-only lg:truncate">Search items...</span>
        </button>

        {/* Only where the field it sits inside exists. */}
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
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
