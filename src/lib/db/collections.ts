import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import type {
  CollectionItemType,
  CollectionStats,
  DashboardCollection,
  SidebarCollection,
  SidebarCollections,
} from '@/types/collection';

interface TypeUsage {
  type: CollectionItemType;
  count: number;
}

/** Most used type first, then alphabetically so the icon order is stable. */
const byUsageDesc = (a: TypeUsage, b: TypeUsage) =>
  b.count - a.count || a.type.name.localeCompare(b.type.name);

/**
 * Item types used by each of the given collections, most used first.
 *
 * Counting per (collection, type) in the database keeps the item rows out of
 * the response — callers only need totals and the type mix.
 */
async function getTypeUsage(collectionIds: string[]): Promise<Map<string, TypeUsage[]>> {
  const usageByCollection = new Map<string, TypeUsage[]>();

  if (collectionIds.length === 0) return usageByCollection;

  const usage = await prisma.item.groupBy({
    by: ['collectionId', 'typeId'],
    where: { collectionId: { in: collectionIds } },
    _count: { _all: true },
  });

  const types = await prisma.itemType.findMany({
    where: { id: { in: [...new Set(usage.map((row) => row.typeId))] } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const typeById = new Map(types.map((type) => [type.id, type]));

  for (const row of usage) {
    const type = typeById.get(row.typeId);

    // collectionId is nullable on Item; the where clause already excludes nulls.
    if (!row.collectionId || !type) continue;

    const entries = usageByCollection.get(row.collectionId) ?? [];
    entries.push({ type, count: row._count._all });
    usageByCollection.set(row.collectionId, entries);
  }

  for (const entries of usageByCollection.values()) {
    entries.sort(byUsageDesc);
  }

  return usageByCollection;
}

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

  const usageByCollection = await getTypeUsage(collections.map((collection) => collection.id));

  return collections.map((collection) => {
    const entries = usageByCollection.get(collection.id) ?? [];

    return {
      ...collection,
      itemCount: entries.reduce((total, entry) => total + entry.count, 0),
      types: entries.map((entry) => entry.type),
      accentColor: entries[0]?.type.color ?? null,
    };
  });
}

/**
 * Collections for the sidebar, split into favorites and the most recently
 * updated of the rest. A collection appears in one group or the other, never
 * both.
 */
export async function getSidebarCollections(recentLimit: number): Promise<SidebarCollections> {
  const userId = await getCurrentUserId();

  if (!userId) return { favorites: [], recent: [] };

  const select = { id: true, name: true };

  const [favorites, recent] = await Promise.all([
    prisma.collection.findMany({
      where: { userId, isFavorite: true },
      orderBy: { updatedAt: 'desc' },
      select,
    }),
    prisma.collection.findMany({
      where: { userId, isFavorite: false },
      orderBy: { updatedAt: 'desc' },
      take: recentLimit,
      select,
    }),
  ]);

  const usageByCollection = await getTypeUsage(
    [...favorites, ...recent].map((collection) => collection.id)
  );

  const toSidebarCollection = (collection: { id: string; name: string }): SidebarCollection => {
    const entries = usageByCollection.get(collection.id) ?? [];

    return {
      ...collection,
      itemCount: entries.reduce((total, entry) => total + entry.count, 0),
      accentColor: entries[0]?.type.color ?? null,
    };
  };

  return {
    favorites: favorites.map(toSidebarCollection),
    recent: recent.map(toSidebarCollection),
  };
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
