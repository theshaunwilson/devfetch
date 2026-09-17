import type { Metadata } from 'next';

import { FavoritesView } from '@/components/favorites/FavoritesView';
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

  // The two queries stay here; ordering is the client's, so that changing it
  // costs no request. Both rows cross the boundary as plain objects, their
  // dates already serialized to ISO in the db layer.
  return <FavoritesView items={items} collections={collections} />;
}
