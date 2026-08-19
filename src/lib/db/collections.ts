import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import type { CollectionItemType, CollectionStats, DashboardCollection } from '@/types/collection';

// No auth yet, so the dashboard reads the seeded demo user. Replaced by the
// session user once NextAuth is wired up.
const DEMO_USER_EMAIL = 'demo@devfetch.io';

/** Cached per request so parallel dashboard queries share one lookup. */
const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  return user?.id ?? null;
});

interface TypeUsage {
  type: CollectionItemType;
  count: number;
}

/** Most used type first, then alphabetically so the icon order is stable. */
const byUsageDesc = (a: TypeUsage, b: TypeUsage) =>
  b.count - a.count || a.type.name.localeCompare(b.type.name);

/**
 * Most recently updated collections, with the item count and the item types
 * each one holds.
 */
export async function getRecentCollections(limit: number): Promise<DashboardCollection[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      isFavorite: true,
    },
  });

  if (collections.length === 0) return [];

  // Counting per (collection, type) in the database keeps the item rows out
  // of the response — the cards only need totals and icons.
  const usage = await prisma.item.groupBy({
    by: ['collectionId', 'typeId'],
    where: { collectionId: { in: collections.map((collection) => collection.id) } },
    _count: { _all: true },
  });

  const types = await prisma.itemType.findMany({
    where: { id: { in: [...new Set(usage.map((row) => row.typeId))] } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const typeById = new Map(types.map((type) => [type.id, type]));
  const usageByCollection = new Map<string, TypeUsage[]>();

  for (const row of usage) {
    const type = typeById.get(row.typeId);

    // collectionId is nullable on Item; the where clause already excludes nulls.
    if (!row.collectionId || !type) continue;

    const entries = usageByCollection.get(row.collectionId) ?? [];
    entries.push({ type, count: row._count._all });
    usageByCollection.set(row.collectionId, entries);
  }

  return collections.map((collection) => {
    const entries = (usageByCollection.get(collection.id) ?? []).sort(byUsageDesc);

    return {
      ...collection,
      itemCount: entries.reduce((total, entry) => total + entry.count, 0),
      types: entries.map((entry) => entry.type),
      accentColor: entries[0]?.type.color ?? null,
    };
  });
}

/** Collection counts for the dashboard stat tiles. */
export async function getCollectionStats(): Promise<CollectionStats> {
  const userId = await getCurrentUserId();

  if (!userId) return { total: 0, favorites: 0 };

  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}
