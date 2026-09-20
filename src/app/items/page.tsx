import type { Metadata } from 'next';
import { FileText, ImageIcon } from 'lucide-react';
import { NewItemButton } from '@/components/items/NewItemButton';
import { FileRow } from '@/components/items/FileRow';
import { ImageCard } from '@/components/items/ImageCard';
import { ItemCard } from '@/components/items/ItemCard';
import { SectionHeading } from '@/components/layout/SectionHeading';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { isProUser } from '@/lib/db/billing';
import { getCollectionOptions } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/item-types';
import { getAllItems } from '@/lib/db/items';
import { groupItemsByShape } from '@/lib/items';
import { parsePageParam } from '@/lib/pagination';

// Reads the signed-in user's items per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'All items | Devfetch' };

export default async function AllItemsPage({ searchParams }: PageProps<'/items'>) {
  const { page } = await searchParams;
  const { items, pagination } = await getAllItems(parsePageParam(page));

  // Both free: `getItemTypes` and `getCollectionOptions` are request-cached and
  // `AppShell` has already called each of them.
  const [itemTypes, collectionOptions, isPro] = await Promise.all([
    getItemTypes(),
    getCollectionOptions(),
    isProUser(),
  ]);

  // Uploads are a different kind of thing from a snippet or a prompt and show a
  // different shape, so each gets a run of its own below the text items rather
  // than being interleaved by date — as `/collections/[id]` does it. Grouping
  // happens after the page is cut, so a page shows whichever of the three its
  // own items fall into.
  const { cards, images, files } = groupItemsByShape(items);

  return (
    <div className="px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">All items</h1>
          {/* The total rather than this page's length. */}
          <p className="mt-1 text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* No `defaultTypeSlug`: this page is every type, so the dialog opens
            on its own fallback rather than one picked arbitrarily here. */}
        <NewItemButton itemTypes={itemTypes} isPro={isPro} collectionOptions={collectionOptions} />
      </div>

      {items.length > 0 ? (
        <div className="mt-8 flex flex-col gap-10">
          {/* Unlabelled, as on a collection page: these are the items, and a
              heading would only earn its place if the other two always
              appeared. */}
          {cards.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {images.length > 0 && (
            <section>
              <SectionHeading icon={ImageIcon} title="Images" count={images.length} />
              {/* A thumbnail carries a narrower card than a title-and-tags one,
                  so the gallery reaches three columns a breakpoint earlier. */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((item) => (
                  <ImageCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section>
              <SectionHeading icon={FileText} title="Files" count={files.length} />
              {/* One column at every width: a row is a line of metadata, and
                  two side by side read as a table. */}
              <div className="flex flex-col gap-2">
                {files.map((item) => (
                  <FileRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No items yet.</p>
      )}

      {/* Renders nothing when there is only one page, so it needs no guard of
          its own — including on the empty state, which is always page 1. */}
      <PaginationControls pagination={pagination} basePath="/items" />
    </div>
  );
}
