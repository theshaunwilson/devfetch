// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { visibleItemTypeFilter } from '@/lib/db/item-types';
import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import { SEARCH_PREVIEW_LENGTH } from '@/lib/search';
import type { CreateItemData, UpdateItemData } from '@/lib/validation/items';
import { Prisma } from '@/generated/prisma/client';
import type {
  DashboardItem,
  DeletedItem,
  ItemContentType,
  ItemDetail,
  ItemFile,
  ItemsByCollection,
  ItemsByType,
  ItemStats,
} from '@/types/item';
import type { SearchItem } from '@/types/search';

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
  // The file list shows the size, and shows `createdAt` as the upload date:
  // an item's file cannot be replaced, so the row was created when the object
  // arrived, while `updatedAt` moves on every title or tag edit.
  fileSize: true,
  createdAt: true,
  // The slug rather than only the name: a card decides from it whether its
  // copy button has anything to copy, and the drawer's edit form picks its
  // type-specific fields from it. A name is user-facing text, and
  // @@unique([userId, slug]) lets a custom type reuse a system slug.
  type: { select: { id: true, name: true, slug: true, icon: true, color: true } },
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
    fileSize: item.fileSize,
    createdAt: item.createdAt.toISOString(),
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
    where: { slug, ...visibleItemTypeFilter(userId) },
    // @@unique([userId, slug]) allows a custom type to reuse a system slug, so
    // two rows can match. Prefer the user's own.
    orderBy: { userId: { sort: 'desc', nulls: 'last' } },
    select: { id: true, name: true, slug: true, icon: true, color: true },
  });

  if (!type) return null;

  const items = await prisma.item.findMany({
    where: { userId, typeId: type.id },
    orderBy: { updatedAt: 'desc' },
    select: ITEM_SELECT,
  });

  return { type, items: items.map(toDashboardItem) };
});

/**
 * One collection resolved from its id, with the current user's items filed in
 * it, most recently updated first.
 *
 * Lives here rather than in `collections.ts` for the reason `getItemsByTypeSlug`
 * does: it resolves a parent entity and then returns items, which needs the
 * module-private `ITEM_SELECT` and `toDashboardItem`. Exporting those into the
 * collections module would leak an item's row shape into it.
 *
 * The id arrives from the URL, so the lookup is `findFirst` on `{ id, userId }`
 * rather than `findUnique` on the id alone — the ownership-in-the-where rule
 * `getItemDetail`, `updateItem` and `deleteItem` all follow. Null therefore
 * means "no such collection of yours", so somebody else's id reads exactly like
 * one that never existed, and the caller can 404 both the same way.
 *
 * Items are read through the join rather than a column: `Item.collectionId` is
 * gone as of the many-to-many. The filter asserts ownership on both sides —
 * the collection is already known to be the user's, and `item: { userId }`
 * keeps that true of every row that comes back.
 *
 * Cached, because the page and its `generateMetadata` both ask for it.
 */
export const getItemsByCollectionId = cache(
  async (id: string): Promise<ItemsByCollection | null> => {
    const userId = await getCurrentUserId();

    if (!userId) return null;

    const collection = await prisma.collection.findFirst({
      where: { id, userId },
      select: { id: true, name: true, description: true, isFavorite: true },
    });

    if (!collection) return null;

    const filings = await prisma.itemCollection.findMany({
      where: { collectionId: collection.id, item: { userId } },
      orderBy: { item: { updatedAt: 'desc' } },
      select: { item: { select: ITEM_SELECT } },
    });

    return { collection, items: filings.map((filing) => toDashboardItem(filing.item)) };
  }
);

/**
 * Every item the command palette searches, most recently updated first.
 *
 * Two queries rather than one, because of `content`. It holds up to 100,000
 * characters and `ITEM_SELECT` deliberately omits it, so selecting it here
 * would pull every body out of Postgres in full on every shell render —
 * Prisma cannot truncate in a `select`, so the preview is taken with `LEFT()`
 * in raw SQL and merged in by id.
 *
 * The second query is filtered by the ids the first returned rather than
 * repeating the `ORDER BY`/`LIMIT`: run independently the two could disagree
 * about which items tie at the same `updatedAt`, and an item would silently
 * lose its preview. It still filters on `userId` as well, so the raw statement
 * carries the ownership predicate itself rather than trusting the ids handed
 * to it.
 */
export async function getSearchItems(limit: number): Promise<SearchItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: ITEM_SELECT,
  });

  if (items.length === 0) return [];

  const previews = await prisma.$queryRaw<{ id: string; preview: string | null }[]>`
    SELECT "id", LEFT("content", ${SEARCH_PREVIEW_LENGTH}::int) AS "preview"
    FROM "Item"
    WHERE "userId" = ${userId}
      AND "content" IS NOT NULL
      AND "id" IN (${Prisma.join(items.map((item) => item.id))})
  `;

  const previewById = new Map(previews.map((row) => [row.id, row.preview]));

  return items.map((item) => ({
    ...toDashboardItem(item),
    contentPreview: previewById.get(item.id) ?? null,
  }));
}

/** Everything the detail drawer renders on top of what a card already holds. */
const ITEM_DETAIL_SELECT = {
  ...ITEM_SELECT,
  content: true,
  language: true,
  url: true,
  // The type, every file field and createdAt all come through the spread above.
  collections: {
    select: { collection: { select: { id: true, name: true } } },
    // Join rows have no natural order, the same reason tags are sorted by name.
    orderBy: { collection: { name: 'asc' } },
  },
} satisfies Prisma.ItemSelect;

type ItemDetailPayload = Prisma.ItemGetPayload<{ select: typeof ITEM_DETAIL_SELECT }>;

function toItemDetail(item: ItemDetailPayload): ItemDetail {
  return {
    ...toDashboardItem(item),
    content: item.content,
    language: item.language,
    url: item.url,
    collections: item.collections.map((filing) => filing.collection),
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
  const { fileUrl, fileName, fileSize, collectionIds } = data;

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
      // Connected by id, not created: a collection has to exist to be filed
      // into, and the caller has already resolved these against the ones this
      // user owns — see `getOwnedCollectionIds`.
      collections: {
        create: (collectionIds ?? []).map((id) => ({ collection: { connect: { id } } })),
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

  const { title, description, content, language, url, tags, collectionIds } = data;

  // Assigned one at a time rather than spread: `undefined` in a Prisma `data`
  // object is ignored, but an explicit `null` clears the column, and the two
  // have to stay distinguishable.
  const fields: Prisma.ItemUpdateInput = { title };

  if (description !== undefined) fields.description = description;
  if (content !== undefined) fields.content = content;
  if (language !== undefined) fields.language = language;
  if (url !== undefined) fields.url = url;

  if (collectionIds) {
    fields.collections = {
      // Replaced rather than diffed, exactly like tags: every filing goes, then
      // the chosen set is connected. An empty array is therefore how an item is
      // taken out of every collection — which is why `undefined` has to keep
      // meaning "the form never showed this field, leave it alone".
      deleteMany: {},
      create: collectionIds.map((id) => ({ collection: { connect: { id } } })),
    };
  }

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

