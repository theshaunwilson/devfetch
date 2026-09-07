// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import type { CreateItemData, UpdateItemData } from '@/lib/validation/items';
import { Prisma } from '@/generated/prisma/client';
import type {
  DashboardItem,
  DeletedItem,
  ItemContentType,
  ItemDetail,
  ItemFile,
  ItemsByType,
  ItemStats,
  ItemTypeRef,
  SidebarItemType,
} from '@/types/item';

/** Everything an item row renders: type for the icon and border, plus tags. */
const ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  isFavorite: true,
  isPinned: true,
  updatedAt: true,
  // Two columns every list pays for, so that an image card can tell an item
  // that has an object from one that does not before it renders an <img>. The
  // key itself is never used by a card — the object is fetched through
  // /api/files/[id], which takes the item's id — only its presence is.
  fileUrl: true,
  fileName: true,
  type: { select: { id: true, name: true, icon: true, color: true } },
  tags: {
    select: { tag: { select: { name: true } } },
    // Join rows have no natural order, so sort for a stable badge order.
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.ItemSelect;

type ItemPayload = Prisma.ItemGetPayload<{ select: typeof ITEM_SELECT }>;

function toDashboardItem(item: ItemPayload): DashboardItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
    updatedAt: item.updatedAt.toISOString(),
    fileUrl: item.fileUrl,
    fileName: item.fileName,
    type: item.type,
    tags: item.tags.map((itemTag) => itemTag.tag.name),
  };
}

/**
 * Every pinned item, most recently updated first. Not limited — pinning is a
 * deliberate act, so the list is expected to stay short.
 */
export async function getPinnedItems(): Promise<DashboardItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: 'desc' },
    select: ITEM_SELECT,
  });

  return items.map(toDashboardItem);
}

/** Most recently updated items, whether pinned or not. */
export async function getRecentItems(limit: number): Promise<DashboardItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: ITEM_SELECT,
  });

  return items.map(toDashboardItem);
}

/**
 * One item type resolved from its slug, with the current user's items of that
 * type, most recently updated first.
 *
 * Returns null when the slug names no type the user can see, so the caller can
 * tell a bad slug from a type that simply holds no items.
 *
 * Cached, because the page and its `generateMetadata` both ask for it.
 */
export const getItemsByTypeSlug = cache(async (slug: string): Promise<ItemsByType | null> => {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  const type = await prisma.itemType.findFirst({
    // System types are global (userId: null), so they cannot be matched on
    // userId alone.
    where: { slug, OR: [{ userId: null }, { userId }] },
    // @@unique([userId, slug]) allows a custom type to reuse a system slug, so
    // two rows can match. Prefer the user's own.
    orderBy: { userId: { sort: 'desc', nulls: 'last' } },
    select: { id: true, name: true, icon: true, color: true },
  });

  if (!type) return null;

  const items = await prisma.item.findMany({
    where: { userId, typeId: type.id },
    orderBy: { updatedAt: 'desc' },
    select: ITEM_SELECT,
  });

  return { type, items: items.map(toDashboardItem) };
});

/** Everything the detail drawer renders on top of what a card already holds. */
const ITEM_DETAIL_SELECT = {
  ...ITEM_SELECT,
  // Widened rather than inherited: the edit form picks which type-specific
  // fields to show from the slug, and a card has no use for it.
  type: { select: { id: true, name: true, slug: true, icon: true, color: true } },
  content: true,
  language: true,
  url: true,
  // fileUrl and fileName come through the spread above.
  fileSize: true,
  createdAt: true,
  collection: { select: { id: true, name: true } },
} satisfies Prisma.ItemSelect;

type ItemDetailPayload = Prisma.ItemGetPayload<{ select: typeof ITEM_DETAIL_SELECT }>;

function toItemDetail(item: ItemDetailPayload): ItemDetail {
  return {
    ...toDashboardItem(item),
    type: item.type,
    content: item.content,
    language: item.language,
    url: item.url,
    fileSize: item.fileSize,
    collection: item.collection,
    createdAt: item.createdAt.toISOString(),
  };
}

/**
 * One item in full, for the detail drawer.
 *
 * Scoped to the signed-in user, so an id belonging to somebody else reads the
 * same as an id that does not exist. Returns null in both cases, and when
 * nobody is signed in.
 */
export async function getItemDetail(id: string): Promise<ItemDetail | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  // findFirst, not findUnique: the userId filter is what makes this safe, and
  // findUnique would only accept the id.
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: ITEM_DETAIL_SELECT,
  });

  if (!item) return null;

  return toItemDetail(item);
}

/**
 * The stored object behind one item, for the download proxy.
 *
 * Its own query rather than `getItemDetail`, because the proxy runs on every
 * image an items page draws and has no use for content, tags or collections —
 * and because this is the check that authorises the read: the object key is
 * only ever reached through an item the signed-in user owns. Returns null for
 * an unknown id, somebody else's id, and an item with no file alike.
 */
export async function getItemFile(id: string): Promise<ItemFile | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  // findFirst, not findUnique: the ownership filter is what makes this safe.
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: {
      fileUrl: true,
      fileName: true,
      fileSize: true,
      type: { select: { slug: true } },
    },
  });

  if (!item?.fileUrl || !item.fileName) return null;

  return {
    key: item.fileUrl,
    fileName: item.fileName,
    fileSize: item.fileSize,
    typeSlug: item.type.slug,
  };
}

/**
 * One item type the current user is allowed to file an item under — a global
 * system type or a custom type of their own.
 *
 * The id arrives from the client, so this is the check that stops an item being
 * attached to somebody else's custom type. Returns null when the id names no
 * such type, which reads the same either way. The slug comes back because the
 * caller needs it to decide which fields the type requires.
 */
export async function getItemTypeById(id: string): Promise<ItemTypeRef | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  // findFirst, not findUnique: the ownership filter is what makes this safe,
  // and findUnique would accept the id on its own.
  return prisma.itemType.findFirst({
    // System types are global (userId: null), so they cannot be matched on
    // userId alone.
    where: { id, OR: [{ userId: null }, { userId }] },
    select: { id: true, slug: true },
  });
}

/**
 * Writes a new item and returns it in full, like `updateItem` does.
 *
 * The owner comes from the session, never from the caller, so there is no way
 * to create an item under another user's name. The type is expected to have
 * been resolved through `getItemTypeById` first — a raw `typeId` is not
 * something this function can vouch for.
 *
 * Blanks were turned into nulls by the schema and are written as such: on a
 * create there is nothing behind a field to preserve, so unlike `updateItem`
 * there is no need to keep `undefined` and `null` apart, and an omitted field
 * and a cleared one both mean an empty column.
 *
 * `contentType` is a parameter rather than part of `data` because it is not the
 * caller's to choose: it follows from the resolved type, and taking it from the
 * payload would let a text item claim to hold a file.
 */
export async function createItem(
  data: CreateItemData,
  contentType: ItemContentType,
): Promise<ItemDetail | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  const { typeId, title, description, content, language, url, tags } = data;
  const { fileUrl, fileName, fileSize } = data;

  const item = await prisma.item.create({
    data: {
      title,
      // Decided by the caller from the resolved type, never sent by the client.
      contentType,
      description: description ?? null,
      content: content ?? null,
      language: language ?? null,
      url: url ?? null,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      fileSize: fileSize ?? null,
      user: { connect: { id: userId } },
      type: { connect: { id: typeId } },
      tags: {
        create: (tags ?? []).map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId, name } },
              create: { userId, name },
            },
          },
        })),
      },
    },
    select: ITEM_DETAIL_SELECT,
  });

  return toItemDetail(item);
}

/**
 * Writes the editable half of one item and returns it in full.
 *
 * Scoped to the signed-in user inside the `where` clause rather than by reading
 * the row first: the id comes from the client, so the ownership filter has to
 * be part of the write itself — a read-then-write could be raced, and
 * `findUnique` would accept the id alone. No match returns null, so an item
 * belonging to somebody else is indistinguishable from one that never existed.
 *
 * Only the keys the caller actually sent are written. A field the edit form
 * never showed — content on a link item, say — is absent rather than blank, so
 * it is left as it was instead of being cleared.
 */
export async function updateItem(id: string, data: UpdateItemData): Promise<ItemDetail | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  const { title, description, content, language, url, tags } = data;

  // Assigned one at a time rather than spread: `undefined` in a Prisma `data`
  // object is ignored, but an explicit `null` clears the column, and the two
  // have to stay distinguishable.
  const fields: Prisma.ItemUpdateInput = { title };

  if (description !== undefined) fields.description = description;
  if (content !== undefined) fields.content = content;
  if (language !== undefined) fields.language = language;
  if (url !== undefined) fields.url = url;

  if (tags) {
    fields.tags = {
      // Replace rather than diff, as the spec asks: every join row goes, then
      // the new set is connected, creating any tag the user does not own yet.
      deleteMany: {},
      create: tags.map((name) => ({
        tag: {
          connectOrCreate: {
            where: { userId_name: { userId, name } },
            create: { userId, name },
          },
        },
      })),
    };
  }

  try {
    const item = await prisma.item.update({
      // Not a unique filter on its own — Prisma allows the extra scalar here,
      // and that is the whole point: the update matches nothing at all when the
      // item is not this user's.
      where: { id, userId },
      data: fields,
      select: ITEM_DETAIL_SELECT,
    });

    return toItemDetail(item);
  } catch (error) {
    // P2025: no row matched the filter. Unknown id and somebody else's id both
    // land here, and both mean the same thing to the caller.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }

    throw error;
  }
}

/**
 * Deletes one item, returning whether it was this user's to delete.
 *
 * Scoped in the `where` of the delete itself, exactly like `updateItem`: the id
 * comes from the client, and putting the owner in the filter is what stops it
 * reaching another user's row — a read-then-delete would leave a window between
 * the two.
 *
 * `ItemTag` cascades from `Item`, so the join rows go with it. The `Tag` rows
 * themselves stay, which is the same orphan the edit feature left behind.
 *
 * The deleted row's `fileUrl` comes back so the caller can remove the stored
 * object. Removing it here instead would put storage inside a database module,
 * and the row is authoritative: it goes first, and a failed object delete
 * leaves a harmless orphan rather than an item pointing at nothing.
 */
export async function deleteItem(id: string): Promise<DeletedItem> {
  const userId = await getCurrentUserId();

  if (!userId) return { deleted: false, fileKey: null };

  try {
    // Prisma returns the row it deleted, so the object's key comes back without
    // a read of its own — and it comes from the same statement that proved the
    // item was this user's, so there is no window in which the two disagree.
    const item = await prisma.item.delete({
      where: { id, userId },
      select: { fileUrl: true },
    });

    return { deleted: true, fileKey: item.fileUrl };
  } catch (error) {
    // P2025: nothing matched. An unknown id and somebody else's id both land
    // here, and the caller cannot tell them apart — which is the point.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { deleted: false, fileKey: null };
    }

    throw error;
  }
}

/** Item counts for the dashboard stat tiles. */
export async function getItemStats(): Promise<ItemStats> {
  const userId = await getCurrentUserId();

  if (!userId) return { total: 0, favorites: 0 };

  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

/**
 * Item types available to the current user — the global system types plus any
 * custom types they own — each with how many of their items use it.
 *
 * Ordered by creation so the built-in types keep the order they were seeded in,
 * with custom types appended after them.
 *
 * `cache`d because more than one place needs the list per request: `AppShell`
 * for the sidebar, and the items page for its own create button. Without it
 * they would each pay for the findMany and the groupBy.
 */
export const getItemTypes = cache(async (): Promise<SidebarItemType[]> => {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const [types, usage] = await Promise.all([
    prisma.itemType.findMany({
      // System types are global (userId: null), so they cannot be matched on
      // userId alone.
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, icon: true, color: true },
    }),
    // Counting in the database keeps the item rows out of the response.
    prisma.item.groupBy({
      by: ['typeId'],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const countByType = new Map(usage.map((row) => [row.typeId, row._count._all]));

  return types.map((type) => ({
    ...type,
    itemCount: countByType.get(type.id) ?? 0,
  }));
});
