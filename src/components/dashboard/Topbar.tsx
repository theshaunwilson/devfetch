import Link from 'next/link';
import { Zap } from 'lucide-react';

import { CreateMenu } from '@/components/dashboard/CreateMenu';
import { TopbarBrand } from '@/components/dashboard/TopbarBrand';
import { TopbarFavoritesLink } from '@/components/dashboard/TopbarFavoritesLink';
import { TopbarToggle } from '@/components/dashboard/TopbarToggle';
import { SearchPalette } from '@/components/search/SearchPalette';
import { Button } from '@/components/ui/button';
import { UPGRADE_PATH } from '@/lib/pro';
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
  isPro,
  collectionOptions,
  searchItems,
}: {
  itemTypes: SidebarItemType[];
  /**
   * Threaded to the create dialog, which gates the two upload types — and
   * decides whether the Upgrade button is offered at all.
   */
  isPro: boolean;
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
          {/*
            Only for a free account — there is nothing to sell a paying one,
            and `/upgrade` sends it to /settings anyway.

            `ghost` on purpose, and the quietest control in the cluster: the
            create button beside it is filled and the two labelled ones from
            `lg` are filled and outlined. This is an offer rather than a tool,
            so it reads as a link with a hit area rather than as a fourth
            action competing with them. `h-10` to match the 40px icons it sits
            beside, since the default size is 32px and would sit short.

            The bolt carries the emphasis instead of the button's fill, and it
            is the `--pro` token because that is already what Pro looks like in
            this app — `ProBadge` uses the same one.
            `Zap` rather than `Sparkles`, which is the Prompt item type's own
            icon and renders in the sidebar a few pixels from here.

            The word drops below `sm`, leaving the bolt alone. Measured, the
            labelled button needs 374px of bar and so fits a 375 or 390 phone
            but overflows a 360 one — and at 320 it pushed the create button
            22px past the viewport. `sr-only sm:not-sr-only` keeps the
            accessible name "Upgrade" at every width while only the glyph is
            painted on a phone, which is what `FileRow`'s Download button does
            with the same problem.
          */}
          {!isPro && (
            <Button asChild variant="ghost" className="h-10 px-2.5 sm:px-3">
              <Link href={UPGRADE_PATH}>
                <Zap className="size-4 text-pro" />
                <span className="sr-only sm:not-sr-only">Upgrade</span>
              </Link>
            </Button>
          )}

          <TopbarFavoritesLink />

          <CreateMenu itemTypes={itemTypes} isPro={isPro} collectionOptions={collectionOptions} />
        </div>
      </div>
    </header>
  );
}
