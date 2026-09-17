import type { Metadata } from 'next';
import { Folder, List } from 'lucide-react';

import { FavoriteCollectionRow } from '@/components/favorites/FavoriteCollectionRow';
import { FavoriteItemRow } from '@/components/favorites/FavoriteItemRow';
import { SectionHeading } from '@/components/layout/SectionHeading';
import { getFavoriteCollections } from '@/lib/db/collections';
import { getFavoriteItems } from '@/lib/db/items';

export const metadata: Metadata = {
  title: 'Favorites | Devfetch',
};

// Reads the signed-in user's favorites per request, so it cannot be
// prerendered.
export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const [items, collections] = await Promise.all([getFavoriteItems(), getFavoriteCollections()]);

  // Both lists are unpaged, so a length is the total — unlike the paged lists,
  // where reading `items.length` as a count was a real defect.
  const total = items.length + collections.length;

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Favorites</h1>
      <p className="mt-1 text-muted-foreground">
        {total} {total === 1 ? 'favorite' : 'favorites'}
      </p>

      {total > 0 ? (
        <div className="mt-8 flex flex-col gap-8">
          {/* Each section hides when empty rather than showing a zero, the way
              the dashboard's Pinned list and the sidebar's group labels do. */}
          {items.length > 0 && (
            <section>
              <SectionHeading icon={List} title="Items" count={items.length} />
              <ul className="divide-y divide-border/60 font-mono text-sm">
                {items.map((item) => (
                  <FavoriteItemRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          )}

          {collections.length > 0 && (
            <section>
              <SectionHeading icon={Folder} title="Collections" count={collections.length} />
              <ul className="divide-y divide-border/60 font-mono text-sm">
                {collections.map((collection) => (
                  <FavoriteCollectionRow key={collection.id} collection={collection} />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        // Deliberately not "star something and it will show up here": nothing
        // in the app writes `isFavorite` yet, so that would promise an action
        // the user cannot take.
        <p className="mt-8 text-sm text-muted-foreground">No favorites yet.</p>
      )}
    </div>
  );
}
