'use client';

import { defaultFilter } from 'cmdk';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import { useSearchPalette } from '@/hooks/use-search-palette';
import { scoreKeywords } from '@/lib/search';
import type { CollectionOption } from '@/types/collection';
import type { SearchItem } from '@/types/search';

import { CollectionResultRow, ItemResultRow } from './SearchResultRows';
import { SearchTrigger } from './SearchTrigger';

/**
 * Scores a row against its keywords rather than its `value` — see
 * `SearchResultRows` for why the value is the id.
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
 * listener, in `useSearchPalette`.
 */
export function SearchPalette({
  items,
  collections,
}: {
  items: SearchItem[];
  collections: CollectionOption[];
}) {
  const { open, setOpen, show, triggerRef, selectItem, selectCollection, restoreFocus } =
    useSearchPalette();

  return (
    <>
      <SearchTrigger ref={triggerRef} onOpen={show} />

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search your items and collections"
        className="sm:max-w-xl"
        onCloseAutoFocus={restoreFocus}
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
                {items.map((item) => (
                  <ItemResultRow key={item.id} item={item} onSelect={selectItem} />
                ))}
              </CommandGroup>
            )}

            {collections.length > 0 && (
              <CommandGroup heading="Collections">
                {collections.map((collection) => (
                  <CollectionResultRow
                    key={collection.id}
                    collection={collection}
                    onSelect={selectCollection}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
