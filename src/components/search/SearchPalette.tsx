'use client';

import { defaultFilter } from 'cmdk';
import { Folder, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useItemDrawer } from '@/components/items/ItemDrawerProvider';
import { Button } from '@/components/ui/button';
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
      {/* An icon rather than a labelled field. The wide field carried a visible
          label and a ⌘K hint, and neither survived the shrink — the label had
          already been shortened twice because the row was never as wide as the
          wording wanted, and the hint was positioned inside the row that is now
          gone. The shortcut itself is a document listener and is unaffected,
          and the palette's own input still says what it searches in full. */}
      <Button ref={triggerRef} variant="ghost" size="icon" className="size-10" onClick={show}>
        <Search className="size-4" />
        <span className="sr-only">Search</span>
      </Button>

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
