import Link from 'next/link';
import { Star } from 'lucide-react';

import { CreateMenu } from '@/components/dashboard/CreateMenu';
import { TopbarBrand } from '@/components/dashboard/TopbarBrand';
import { TopbarToggle } from '@/components/dashboard/TopbarToggle';
import { SearchPalette } from '@/components/search/SearchPalette';
import { Button } from '@/components/ui/button';
import type { CollectionOption } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';
import type { SearchItem } from '@/types/search';

/**
 * Top bar shell.
 *
 * The item types come down from `AppShell`, which already loads them for the
 * sidebar, so the dialog costs no query of its own. The collections it can file
 * a new item in come the same way, and are the same list the palette searches.
 */
export function Topbar({
  itemTypes,
  collectionOptions,
  searchItems,
}: {
  itemTypes: SidebarItemType[];
  collectionOptions: CollectionOption[];
  searchItems: SearchItem[];
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <TopbarToggle />

      <TopbarBrand />

      {/*
        Two layouts from one tree.

        Below `lg` this row is pushed right by `ml-auto` and holds three
        equal icons, so the bar fits a phone without hiding any of them —
        which the wide field and two labelled buttons could not do.

        From `lg` it takes the remaining width instead: the search becomes the
        field again on the left, and `ml-auto` moves onto the inner group so
        the star and the two labelled create buttons stay right-aligned.
      */}
      <div className="ml-auto flex min-w-0 items-center gap-1 lg:ml-0 lg:flex-1 lg:gap-3">
        <SearchPalette items={searchItems} collections={collectionOptions} />

        <div className="flex shrink-0 items-center gap-1 lg:ml-auto lg:gap-2">
          <Button asChild variant="ghost" size="icon" className="size-10">
            <Link href="/favorites">
              <Star className="size-4" />
              <span className="sr-only">Favorites</span>
            </Link>
          </Button>

          <CreateMenu itemTypes={itemTypes} collectionOptions={collectionOptions} />
        </div>
      </div>
    </header>
  );
}
