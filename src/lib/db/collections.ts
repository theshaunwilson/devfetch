// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { Prisma } from '@/generated/prisma/client';
import { COLLECTIONS_PER_PAGE } from '@/lib/constants';
import { getCurrentUserId } from '@/lib/db/user';
import { buildPagination, pageSkip } from '@/lib/pagination';
import { prisma } from '@/lib/prisma';
import type {
  CreateCollectionData,
  UpdateCollectionData,
} from '@/lib/validation/collections';
import type {
  CollectionItemType,
  CollectionOption,
  CollectionStats,
  CreateCollectionOutcome,
  DashboardCollection,
  PaginatedCollections,
  SidebarCollection,
  SidebarCollections,
  UpdateCollectionOutcome,
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
 * Counted in memory rather than by the database, which is a step back from the
 * `item.groupBy({ by: ['collectionId', 'typeId'] })` this was before items
 * became a many-to-many relation: `collectionId` no longer lives on Item, and
 * Prisma cannot group by a field it reaches through a relation. The
 * alternatives were one `groupBy` per collection or raw SQL, and this keeps
 * both the query count and the module's SQL-free-ness. What comes back is one
 * row per filing for the collections asked about, and nothing else — no item
 * bodies, only each item's `typeId`.
 *
 * Scoped to `userId` like every other query here: the ids come from a
 * user-scoped lookup today, but the filter keeps that true if a caller ever
 * passes an id from a request.
 */
async function getTypeUsage(
  userId: string,
  collectionIds: string[]
): Promise<Map<string, TypeUsage[]>> {
  const usageByCollection = new Map<string, TypeUsage[]>();

  if (collectionIds.length === 0) return usageByCollection;

  const filings = await prisma.itemCollection.findMany({
    // Ownership is asserted through the item, which is where `userId` lives.
    where: { collectionId: { in: collectionIds }, item: { userId } },
    select: { collectionId: true, item: { select: { typeId: true } } },
  });

  // Counted per (collection, type) here instead of in the database.
  const countsByCollection = new Map<string, Map<string, number>>();

  for (const filing of filings) {
    const counts = countsByCollection.get(filing.collectionId) ?? new Map<string, number>();

    counts.set(filing.item.typeId, (counts.get(filing.item.typeId) ?? 0) + 1);
    countsByCollection.set(filing.collectionId, counts);
  }

  const typeIds = new Set<string>();

  for (const counts of countsByCollection.values()) {
    for (const typeId of counts.keys()) typeIds.add(typeId);
  }

  if (typeIds.size === 0) return usageByCollection;

  const types = await prisma.itemType.findMany({
    where: { id: { in: [...typeIds] } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const typeById = new Map(types.map((type) => [type.id, type]));

  for (const [collectionId, counts] of countsByCollection) {
    const entries: TypeUsage[] = [];

    for (const [typeId, count] of counts) {
      const type = typeById.get(typeId);

      if (type) entries.push({ type, count });
    }

    entries.sort(byUsageDesc);
    usageByCollection.set(collectionId, entries);
  }

  return usageByCollection;
}

/** Folds a collection's type usage into the aggregates its card renders. */
function toDashboardCollection(
  collection: { id: string; name: string; description: string | null; isFavorite: boolean },
  usageByCollection: Map<string, TypeUsage[]>
): DashboardCollection {
  const entries = usageByCollection.get(collection.id) ?? [];

  return {
    ...collection,
    itemCount: entries.reduce((total, entry) => total + entry.count, 0),
    types: entries.map((entry) => entry.type),
    accentColor: entries[0]?.type.color ?? null,
  };
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

  return collections.map((collection) => toDashboardCollection(collection, usageByCollection));
}

/**
 * One page of the collections the signed-in user owns, for the `/collections`
 * index.
 *
 * Favorites first, then the rest by most recently updated, so the star
 * `CollectionCard` already draws means something structural in an index rather
 * than only decorative. Postgres sorts `false` before `true`, so `desc` on the
 * boolean is what puts favorites at the top.
 *
 * This was deliberately unbounded, on the grounds that a ceiling on an index
 * would silently hide some of the user's own collections. Paging is what makes
 * a ceiling safe — nothing is hidden, it is on the next page — so the reason
 * for the old decision is what reverses it. `getRecentCollections(limit)` stays
 * as it is: that one is the dashboard's six-card preview of this, with no
 * second page to reach.
 *
 * `getTypeUsage` runs over the page rather than the whole index, so it now
 * aggregates at most `COLLECTIONS_PER_PAGE` collections' worth of join rows.
 */
export async function getAllCollections(requestedPage: number): Promise<PaginatedCollections> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return {
      collections: [],
      pagination: buildPagination({ total: 0, perPage: COLLECTIONS_PER_PAGE, requestedPage: 1 }),
    };
  }

  // Counted before the slice is fetched: the page number arrives from the URL,
  // and clamping it needs the total.
  const total = await prisma.collection.count({ where: { userId } });
  const pagination = buildPagination({
    total,
    perPage: COLLECTIONS_PER_PAGE,
    requestedPage,
  });

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    skip: pageSkip(pagination.page, COLLECTIONS_PER_PAGE),
    take: COLLECTIONS_PER_PAGE,
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

  return {
    collections: collections.map((collection) =>
      toDashboardCollection(collection, usageByCollection)
    ),
    pagination,
  };
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

/**
 * Every collection the signed-in user owns, for the item forms' picker and the
 * command palette's Collections group.
 *
 * `cache()`d because several callers ask per request: `AppShell`, for the top
 * bar's create dialog, the drawer's edit form and the palette, and
 * `/items/[type]`, which renders its own create button. Without it each would
 * issue the same query, the way `getItemTypes` would have.
 *
 * The count is a `_count` on the join rows, which the palette shows beside the
 * name; the picker ignores it. One widened query rather than a second read of
 * the same rows — and it keeps the two lists from drifting apart, since a
 * collection the picker offers is exactly one the palette can find.
 *
 * Ordered by name rather than by `updatedAt` like the dashboard lists: this is a
 * list to find a known collection in, not a list of what happened recently.
 * Unbounded, as the sidebar's favorites already are — a ceiling here would
 * silently make some of the user's own collections unpickable.
 */
export const getCollectionOptions = cache(async (): Promise<CollectionOption[]> => {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    itemCount: collection._count.items,
  }));
});

/**
 * Which of the given collection ids the signed-in user actually owns.
 *
 * The ids arrive from the client, so this is the check that stops an item being
 * filed into somebody else's collection — the same job `getItemTypeById` does
 * for `typeId`. It returns what it found rather than a boolean, so a caller can
 * tell the difference between "all of these are yours" and "one of these is
 * not" and report the second as a field error instead of silently dropping it.
 */
export async function getOwnedCollectionIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const userId = await getCurrentUserId();

  if (!userId) return [];

  const collections = await prisma.collection.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });

  return collections.map((collection) => collection.id);
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

/**
 * Edits one collection's metadata, for the signed-in user only.
 *
 * Ownership rides in the `where` clause of the update itself rather than a read
 * followed by a write: the id arrives from the client, and a check in front of
 * the write leaves a window between the two. Prisma's extended unique filters
 * allow the extra field, and `updateItem` does it the same way.
 *
 * `@@unique([userId, name])` can reject a rename, and a pre-check cannot close
 * the race between two requests — so P2002 becomes an outcome the form renders
 * on the field, exactly as it does for a create. The comparison is the index's
 * own, which is case-sensitive: renaming `React` to `react` succeeds.
 *
 * `color` is not written, here or anywhere: nothing reads it, since a card's
 * accent comes from the collection's most-used item type.
 */
export async function updateCollection(
  id: string,
  data: UpdateCollectionData
): Promise<UpdateCollectionOutcome> {
  const userId = await getCurrentUserId();

  if (!userId) return { ok: false, reason: 'no-session' };

  try {
    await prisma.collection.update({
      where: { id, userId },
      data: {
        name: data.name,
        description: data.description ?? null,
      },
      select: { id: true },
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: the unique index rejected the new name. [userId, name] is the
      // only unique constraint on Collection, so this can mean nothing else.
      if (error.code === 'P2002') return { ok: false, reason: 'duplicate-name' };

      // P2025: nothing matched. An unknown id and somebody else's id both land
      // here, and the caller cannot tell them apart — which is the point.
      if (error.code === 'P2025') return { ok: false, reason: 'not-found' };
    }

    throw error;
  }
}

/**
 * Deletes one collection belonging to the signed-in user.
 *
 * **The items it held are not deleted.** `ItemCollection.collection` is
 * `onDelete: Cascade`, so the join rows go with the collection and the `Item`
 * rows are untouched — an item filed nowhere else simply ends up filed nowhere.
 * That is the whole mechanism: there is no `Item` write here and no transaction,
 * because the schema already says it.
 *
 * Ownership rides in the `where` clause for the same reason the update does.
 */
export async function deleteCollection(id: string): Promise<boolean> {
  const userId = await getCurrentUserId();

  if (!userId) return false;

  try {
    await prisma.collection.delete({
      where: { id, userId },
      select: { id: true },
    });

    return true;
  } catch (error) {
    // P2025: nothing matched, so somebody else's collection reads exactly like
    // one that never existed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }

    throw error;
  }
}
