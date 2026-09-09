// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import type { CreateCollectionData } from '@/lib/validation/collections';
import type {
  CollectionItemType,
  CollectionStats,
  CreateCollectionOutcome,
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
 *
 * Scoped to `userId` like every other query here: the ids come from a
 * user-scoped lookup today, but the filter keeps that true if a caller ever
 * passes an id from a request, and it matches the `userId` indexes on Item.
 */
async function getTypeUsage(
  userId: string,
  collectionIds: string[]
): Promise<Map<string, TypeUsage[]>> {
  const usageByCollection = new Map<string, TypeUsage[]>();

  if (collectionIds.length === 0) return usageByCollection;

  const usage = await prisma.item.groupBy({
    by: ['collectionId', 'typeId'],
    where: { userId, collectionId: { in: collectionIds } },
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

  const usageByCollection = await getTypeUsage(
    userId,
    collections.map((collection) => collection.id)
  );

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
    userId,
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

/**
 * Creates one collection for the signed-in user and returns it as the grid
 * renders it.
 *
 * The owner comes from the session rather than the payload, like every other
 * write here. A brand-new collection is necessarily empty, so the item count,
 * the type mix and the accent colour are known without the `getTypeUsage`
 * aggregation the read paths need.
 *
 * `@@unique([userId, name])` is what decides a duplicate name. A pre-check
 * cannot close the race between two requests, so the index is left to reject
 * it and P2002 is turned into an outcome the form can render on the field.
 * The comparison is the index's own, which is case-sensitive: `React` and
 * `react` are two collections today.
 */
export async function createCollection(
  data: CreateCollectionData
): Promise<CreateCollectionOutcome> {
  const userId = await getCurrentUserId();

  if (!userId) return { ok: false, reason: 'no-session' };

  try {
    const collection = await prisma.collection.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        user: { connect: { id: userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        isFavorite: true,
      },
    });

    return {
      ok: true,
      collection: { ...collection, itemCount: 0, types: [], accentColor: null },
    };
  } catch (error) {
    // P2002: the unique index rejected it. The only unique constraint on
    // Collection is [userId, name], so this can mean nothing else.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, reason: 'duplicate-name' };
    }

    throw error;
  }
}
