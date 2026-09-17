import Link from 'next/link';
import { Star } from 'lucide-react';

import { NewCollectionDialog } from '@/components/collections/NewCollectionDialog';
import { TopbarBrand } from '@/components/dashboard/TopbarBrand';
import { TopbarToggle } from '@/components/dashboard/TopbarToggle';
import { NewItemDialog } from '@/components/items/NewItemDialog';
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

      <SearchPalette items={searchItems} collections={collectionOptions} />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Icon only, and visible at every width unlike the two create
            buttons: it is narrow enough to fit the 390px header, and a link
            is the one thing here that costs nothing to reach on a phone. */}
        <Button asChild variant="ghost" size="icon" className="size-10">
          <Link href="/favorites">
            <Star className="size-4" />
            <span className="sr-only">Favorites</span>
          </Link>
        </Button>

        <NewCollectionDialog />
        <NewItemDialog itemTypes={itemTypes} collectionOptions={collectionOptions} />
      </div>
    </header>
  );
}
