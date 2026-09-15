import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileText, ImageIcon, Star } from 'lucide-react';
import { CollectionActions } from '@/components/collections/CollectionActions';
import { FileRow } from '@/components/items/FileRow';
import { ImageCard } from '@/components/items/ImageCard';
import { ItemCard } from '@/components/items/ItemCard';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { getItemsByCollectionId } from '@/lib/db/items';
import { groupItemsByShape } from '@/lib/items';
import { parsePageParam } from '@/lib/pagination';

// Reads the signed-in user's items per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/collections/[id]'>): Promise<Metadata> {
  const [{ id }, { page }] = await Promise.all([params, searchParams]);
  // The same page the component asks for, so the cached query is hit once
  // rather than keyed twice.
  const result = await getItemsByCollectionId(id, parsePageParam(page));

  // An unknown id renders notFound() below; the generic title covers it.
  return { title: result ? `${result.collection.name} | Devfetch` : 'Collection | Devfetch' };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<'/collections/[id]'>) {
  const [{ id }, { page }] = await Promise.all([params, searchParams]);
  const result = await getItemsByCollectionId(id, parsePageParam(page));

  // Null covers both an id that names nothing and one that names somebody
  // else's collection, so the two are indistinguishable from outside.
  if (!result) {
    notFound();
  }

  const { collection, items, pagination } = result;
  // Uploads are a different kind of thing from a snippet or a prompt and show a
  // different shape, so each gets a run of its own below the text items rather
  // than being interleaved by date. Grouping happens after the page is cut, so
  // a given page shows whichever of the three its own items fall into.
  const { cards, images, files } = groupItemsByShape(items);

  return (
    <div className="px-6 py-8">
      {/* Stacked below `sm`, where three labelled buttons beside a title would
          squeeze the name to nothing; the actions sit top-right above it. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-3xl font-semibold tracking-tight">
            <span className="truncate">{collection.name}</span>
            {collection.isFavorite && (
              <Star className="size-5 shrink-0 fill-yellow-500 text-yellow-500" />
            )}
          </h1>
          {/* The total rather than this page's length, which is what it was
              before the list was paged. */}
          <p className="mt-1 text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? 'item' : 'items'}
          </p>
          {collection.description && (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>

        <div className="sm:shrink-0">
          <CollectionActions
            collection={{
              id: collection.id,
              name: collection.name,
              description: collection.description,
            }}
            isFavorite={collection.isFavorite}
          />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-8 flex flex-col gap-10">
          {/* Unlabelled: these are the collection's items, and a heading over
              them would only earn its place if the other two always appeared. */}
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
                  so the gallery reaches three columns a breakpoint earlier than
                  the grid above — the same widths /items/image uses. */}
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
              {/* One column at every width, as /items/file has it: a row is a
                  line of metadata, and two side by side read as a table. */}
              <div className="flex flex-col gap-2">
                {files.map((item) => (
                  <FileRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No items in this collection yet.</p>
      )}

      {/* Renders nothing when there is only one page, so it needs no guard of
          its own — including on the empty state, which is always page 1. */}
      <PaginationControls pagination={pagination} basePath={`/collections/${id}`} />
    </div>
  );
}

interface SectionHeadingProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
}

/**
 * Title row above an uploads section, with the count that section holds.
 *
 * Deliberately quieter than the page's own `h1`: these label a group within the
 * collection rather than announce a new page, and at `text-xl font-semibold`
 * they competed with the collection's name. The treatment is the drawer's
 * `SectionLabel` — the pattern this codebase already uses for a labelled
 * section inside a larger view.
 */
function SectionHeading({ icon: Icon, title, count }: SectionHeadingProps) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Icon className="size-4" />
      {title}
      <span className="text-xs">{count}</span>
    </h2>
  );
}
