import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileRow } from '@/components/items/FileRow';
import { ImageCard } from '@/components/items/ImageCard';
import { ItemCard } from '@/components/items/ItemCard';
import { NewItemButton } from '@/components/items/NewItemButton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { getCollectionOptions } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/item-types';
import { getItemsByTypeSlug } from '@/lib/db/items';
import { capitalize } from '@/lib/format';
import { parsePageParam } from '@/lib/pagination';
import { isImageUploadType, usesFileList } from '@/lib/uploads';
import { cn } from '@/lib/utils';

// Reads the signed-in user's items per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/items/[type]'>): Promise<Metadata> {
  const [{ type }, { page }] = await Promise.all([params, searchParams]);
  // The same page the component asks for, so the cached query is hit once
  // rather than keyed twice.
  const result = await getItemsByTypeSlug(type, parsePageParam(page));

  // An unknown slug renders notFound() below; the generic title covers it.
  return { title: result ? `${capitalize(result.type.name)} | Devfetch` : 'Items | Devfetch' };
}

export default async function ItemsByTypePage({
  params,
  searchParams,
}: PageProps<'/items/[type]'>) {
  const [{ type }, { page }] = await Promise.all([params, searchParams]);
  const result = await getItemsByTypeSlug(type, parsePageParam(page));

  // A slug naming no visible type is a 404, so a typo reads differently from a
  // type that simply holds nothing.
  if (!result) {
    notFound();
  }

  const { items, pagination } = result;
  const typeName = capitalize(result.type.name);

  // Both free: `getItemTypes` and `getCollectionOptions` are request-cached and
  // `AppShell` has already called each of them.
  //
  // Every type gets a button now that File and Image can be uploaded; they were
  // the only two the dialog would not have opened on.
  const [itemTypes, collectionOptions] = await Promise.all([
    getItemTypes(),
    getCollectionOptions(),
  ]);

  // Uploads get their own layouts: images a gallery of thumbnails, files a
  // single column of rows. The resolved slug decides, not the requested one.
  const isGallery = isImageUploadType(type);
  const isFileList = usesFileList(type);

  return (
    <div className="px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{typeName}</h1>
          {/* The total rather than this page's length, which is what it was
              before the list was paged. */}
          <p className="mt-1 text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* `type` is the resolved type's own slug, not just what was
            requested: the lookup filters on it, so a row that came back
            matched it exactly. */}
        <NewItemButton
          itemTypes={itemTypes}
          collectionOptions={collectionOptions}
          defaultTypeSlug={type}
          label={`New ${typeName}`}
        />
      </div>

      {items.length > 0 ? (
        <div
          className={cn(
            'mt-8 grid gap-4',
            // Files stay one column at every width: a row is a line of
            // metadata, and two of them side by side reads as a table nobody
            // asked for.
            isFileList && 'gap-2',
            // A thumbnail carries a narrower card than a title-and-tags one
            // does, so the gallery reaches three columns a breakpoint earlier
            // than the item grid.
            isGallery && 'sm:grid-cols-2 lg:grid-cols-3',
            !isGallery && !isFileList && 'md:grid-cols-2 xl:grid-cols-3'
          )}
        >
          {items.map((item) => {
            if (isGallery) return <ImageCard key={item.id} item={item} />;
            if (isFileList) return <FileRow key={item.id} item={item} />;

            return <ItemCard key={item.id} item={item} />;
          })}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No items of this type yet.</p>
      )}

      {/* Renders nothing when there is only one page, so it needs no guard of
          its own — including on the empty state, which is always page 1. */}
      <PaginationControls pagination={pagination} basePath={`/items/${type}`} />
    </div>
  );
}
