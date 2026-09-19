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

      {/* Three icons, all the same size, so the bar fits a phone without any
          of them being hidden — which is what the old wide search field and
          two labelled create buttons could not do. */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SearchPalette items={searchItems} collections={collectionOptions} />

        <Button asChild variant="ghost" size="icon" className="size-10">
          <Link href="/favorites">
            <Star className="size-4" />
            <span className="sr-only">Favorites</span>
          </Link>
        </Button>

        <CreateMenu itemTypes={itemTypes} collectionOptions={collectionOptions} />
      </div>
    </header>
  );
}
