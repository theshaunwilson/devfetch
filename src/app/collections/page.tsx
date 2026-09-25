import type { Metadata } from 'next';
import { CollectionCard } from '@/components/dashboard/CollectionCard';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { getAllCollections } from '@/lib/db/collections';
import { parsePageParam } from '@/lib/pagination';

export const metadata: Metadata = {
  title: 'Collections',
};

// Reads the signed-in user's collections per request, so it cannot be
// prerendered.
export const dynamic = 'force-dynamic';

export default async function CollectionsPage({ searchParams }: PageProps<'/collections'>) {
  const { page } = await searchParams;
  const { collections, pagination } = await getAllCollections(parsePageParam(page));

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
      {/* The total rather than this page's length, which is what it was before
          the list was paged. */}
      <p className="mt-1 text-muted-foreground">
        {pagination.total} {pagination.total === 1 ? 'collection' : 'collections'}
      </p>

      {collections.length > 0 ? (
        // The same grid the dashboard's Collections section uses, so the six
        // cards there and a page of them here line up column for column.
        <div className="mt-8 grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No collections yet.</p>
      )}

      {/* Renders nothing when there is only one page, so it needs no guard of
          its own — including on the empty state, which is always page 1. */}
      <PaginationControls pagination={pagination} basePath="/collections" />
    </div>
  );
}
