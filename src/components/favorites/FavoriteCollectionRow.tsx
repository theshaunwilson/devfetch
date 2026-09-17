import Link from 'next/link';
import { Folder } from 'lucide-react';

import { FavoriteRow } from '@/components/favorites/FavoriteRow';
import type { FavoriteCollection } from '@/types/collection';

/**
 * A favorited collection. Clicking anywhere on the row navigates to it.
 *
 * `Folder` in the muted palette rather than a tinted type icon: a collection
 * has no type of its own, and deriving one from the types it holds would mean
 * running the type-usage aggregation for a 16px glyph. A star per row would be
 * noise on a page where everything is starred.
 */
export function FavoriteCollectionRow({ collection }: { collection: FavoriteCollection }) {
  return (
    <FavoriteRow
      icon={Folder}
      color={null}
      title={collection.name}
      badge="Collection"
      date={collection.updatedAt}
    >
      {/* The overlay shape `OpenItemButton` uses, so the two kinds of row focus
          and highlight identically. */}
      <Link
        href={`/collections/${collection.id}`}
        className="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      >
        <span className="sr-only">Open {collection.name}</span>
      </Link>
    </FavoriteRow>
  );
}
