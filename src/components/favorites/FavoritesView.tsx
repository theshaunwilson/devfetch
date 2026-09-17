'use client';

import { useMemo, useState } from 'react';
import { Folder, List } from 'lucide-react';

import { FavoriteCollectionRow } from '@/components/favorites/FavoriteCollectionRow';
import { FavoriteItemRow } from '@/components/favorites/FavoriteItemRow';
import { FavoritesSortControl } from '@/components/favorites/FavoritesSortControl';
import { SectionHeading } from '@/components/layout/SectionHeading';
import {
  DEFAULT_FAVORITE_SORT,
  sortFavoriteCollections,
  sortFavoriteItems,
  type FavoriteSort,
} from '@/lib/favorites-sort';
import type { FavoriteCollection } from '@/types/collection';
import type { DashboardItem } from '@/types/item';

interface FavoritesViewProps {
  items: DashboardItem[];
  collections: FavoriteCollection[];
}

/**
 * The favorites list and the control that orders it.
 *
 * A client component because the sorting is client-side: the page keeps its
 * two server queries and hands the rows over, and choosing a different key
 * reorders what is already here rather than issuing a request. The heading
 * comes with it because the control sits on the heading row and the state
 * driving the control has to live above both the control and the lists.
 *
 * One control governs both sections rather than one per section: under the
 * type key a collection has nothing to compare, so it falls to the name
 * tie-break — see `sortFavoriteCollections`.
 */
export function FavoritesView({ items, collections }: FavoritesViewProps) {
  const [sort, setSort] = useState<FavoriteSort>(DEFAULT_FAVORITE_SORT);

  const sortedItems = useMemo(() => sortFavoriteItems(items, sort), [items, sort]);
  const sortedCollections = useMemo(
    () => sortFavoriteCollections(collections, sort),
    [collections, sort],
  );

  // Both lists are unpaged, so a length is the total — unlike the paged lists,
  // where reading `items.length` as a count was a real defect.
  const total = items.length + collections.length;

  return (
    <div className="px-6 py-8">
      {/* The heading-plus-actions row `/collections/[id]` already uses: side by
          side from `sm` up, stacked below it, with the text block able to
          shrink so a long heading cannot push the control off the page. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Favorites</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {total === 1 ? 'favorite' : 'favorites'}
          </p>
        </div>

        {/* Nothing to order when there is nothing here. */}
        {total > 0 && <FavoritesSortControl sort={sort} onChange={setSort} />}
      </div>

      {total > 0 ? (
        <div className="mt-8 flex flex-col gap-8">
          {/* Each section hides when empty rather than showing a zero, the way
              the dashboard's Pinned list and the sidebar's group labels do. */}
          {sortedItems.length > 0 && (
            <section>
              <SectionHeading icon={List} title="Items" count={sortedItems.length} />
              <ul className="divide-y divide-border/60 font-mono text-sm">
                {sortedItems.map((item) => (
                  <FavoriteItemRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          )}

          {sortedCollections.length > 0 && (
            <section>
              <SectionHeading icon={Folder} title="Collections" count={sortedCollections.length} />
              <ul className="divide-y divide-border/60 font-mono text-sm">
                {sortedCollections.map((collection) => (
                  <FavoriteCollectionRow key={collection.id} collection={collection} />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        // Deliberately not "star something and it will show up here": the rows
        // on this page carry no toggle of their own, so that would point at an
        // action the user cannot take from here.
        <p className="mt-8 text-sm text-muted-foreground">No favorites yet.</p>
      )}
    </div>
  );
}
