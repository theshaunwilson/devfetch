'use server';

import { z } from 'zod';

import { auth } from '@/auth';
import { getOwnedCollectionIds } from '@/lib/db/collections';
import { getItemTypeById } from '@/lib/db/item-types';
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  updateItem as updateItemRow,
} from '@/lib/db/items';
import { requiredFieldsFor } from '@/lib/items';
import { deleteObject } from '@/lib/r2';
import { keyBelongsTo } from '@/lib/uploads';
import { createItemSchema, updateItemSchema } from '@/lib/validation/items';
import type { CreateItemInput, UpdateItemInput } from '@/lib/validation/items';
import type { CreateItemResult, DeleteItemResult, UpdateItemResult } from '@/types/item';

/**
 * Narrows the collection ids a caller sent to the ones they actually own.
 *
 * The ids arrive from the client, so this is what stops an item being filed into
 * somebody else's collection — the same job `getItemTypeById` does for `typeId`,
 * and the reason the resolved ids are what gets written rather than the ones
 * that arrived.
 *
 * A missing id is reported rather than dropped: the caller asked for a filing
 * that did not happen, and an item quietly appearing in fewer collections than
 * were ticked is worse than being told. Unknown and not-yours read the same way,
 * as everywhere else.
 *
 * `undefined` passes straight through, because it means "the form never showed
 * this field" — which `updateItem` reads as "leave the filings alone".
 */
async function resolveCollectionIds(
  ids: string[] | undefined,
): Promise<{ ok: true; ids: string[] | undefined } | { ok: false }> {
  if (!ids) return { ok: true, ids: undefined };

  const owned = await getOwnedCollectionIds(ids);

  // Deduplicated by the schema already, so a count match means a set match.
  if (owned.length !== ids.length) return { ok: false };

  return { ok: true, ids: owned };
}

/**
 * Creates one item for the signed-in user and returns it in full.
 *
 * Nothing arriving from the client is trusted with anything until it has been
 * checked. The owner is never among it — that comes from the session — the type
 * id is resolved against the types this user can actually see, so an item cannot
 * be filed under somebody else's custom type, and the collection ids are
 * resolved the same way, so it cannot be filed into somebody else's collection.
 *
 * The type-specific requirement is applied here rather than in the schema,
 * because it depends on the resolved type's slug: a link item is nothing
 * without its URL, and the caller's own idea of which type it picked is not
 * what decides that.
 */
export async function createItem(data: CreateItemInput): Promise<CreateItemResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  const parsed = createItemSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the highlighted fields and try again.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const type = await getItemTypeById(parsed.data.typeId);

    if (!type) {
      // An unknown type and one belonging to somebody else read the same way.
      return {
        success: false,
        error: 'Check the highlighted fields and try again.',
        fieldErrors: { typeId: ['Choose an item type'] },
      };
    }

    const required = requiredFieldsFor(type.slug);

    if (required.url && !parsed.data.url) {
      return {
        success: false,
        error: 'Check the highlighted fields and try again.',
        fieldErrors: { url: ['URL is required'] },
      };
    }

    if (required.file) {
      const { fileUrl, fileName, fileSize } = parsed.data;

      if (!fileUrl || !fileName || !fileSize) {
        return {
          success: false,
          error: 'Check the highlighted fields and try again.',
          fieldErrors: { fileUrl: ['Upload a file'] },
        };
      }

      // The key arrives from the client, and every later read of that object is
      // authorised by owning the *item* that names it — so without this check a
      // caller could file an item of their own against somebody else's upload
      // and then download it through the proxy entirely legitimately.
      //
      // `session.user.id` is the same id the write uses: `getCurrentUserId`
      // resolves the row by exactly this id, so the key is checked against the
      // owner the item actually gets.
      if (!keyBelongsTo(fileUrl, session.user.id)) {
        return {
          success: false,
          error: 'Check the highlighted fields and try again.',
          fieldErrors: { fileUrl: ['Upload the file again'] },
        };
      }
    }

    const collections = await resolveCollectionIds(parsed.data.collectionIds);

    if (!collections.ok) {
      return {
        success: false,
        error: 'Check the highlighted fields and try again.',
        fieldErrors: { collectionIds: ['Pick collections from your own list'] },
      };
    }

    // The resolved ids rather than the ones that arrived, so what is written is
    // what was checked — for the type and the collections alike. `contentType`
    // is decided here from the resolved slug rather than taken from the payload,
    // so a text item cannot claim to be a file — or the other way round.
    const item = await createItemRow(
      { ...parsed.data, typeId: type.id, collectionIds: collections.ids },
      required.file ? 'file' : 'text',
    );

    if (!item) {
      return { success: false, error: 'Your session has expired. Sign in again.' };
    }

    return { success: true, data: item };
  } catch (error) {
    console.error('Could not create the item:', error);

    return { success: false, error: 'Could not create this item. Please try again.' };
  }
}

/**
 * Saves the editable fields of one item and returns it in full, so the drawer
 * can refresh itself without a second request.
 *
 * A server action is a public endpoint: the id arrives from the client and
 * nothing about it is trusted. The session decides who is asking, and the write
 * itself is scoped to that user — see `updateItem` in `@/lib/db/items`.
 */
export async function updateItem(itemId: string, data: UpdateItemInput): Promise<UpdateItemResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  const parsed = updateItemSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the highlighted fields and try again.',
      // Grouped on the first path segment, so a message Zod paths at `tags.0`
      // still lands on the `tags` field the form renders.
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const collections = await resolveCollectionIds(parsed.data.collectionIds);

    if (!collections.ok) {
      return {
        success: false,
        error: 'Check the highlighted fields and try again.',
        fieldErrors: { collectionIds: ['Pick collections from your own list'] },
      };
    }

    const item = await updateItemRow(itemId, { ...parsed.data, collectionIds: collections.ids });

    if (!item) {
      // Somebody else's item reads exactly like one that does not exist.
      return { success: false, error: 'That item could not be found.' };
    }

    return { success: true, data: item };
  } catch (error) {
    console.error('Could not update the item:', error);

    return { success: false, error: 'Could not save your changes. Please try again.' };
  }
}

/**
 * Deletes one item.
 *
 * Like `updateItem`, the id arrives from the client and is trusted for nothing:
 * the session says who is asking and the delete is itself scoped to that user —
 * see `deleteItem` in `@/lib/db/items`.
 *
 * A file item's stored object goes with it, from here rather than from the
 * query function so that storage stays out of the database module.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  try {
    const { deleted, fileKey } = await deleteItemRow(itemId);

    if (!deleted) {
      // Somebody else's item reads exactly like one that does not exist.
      return { success: false, error: 'That item could not be found.' };
    }

    if (fileKey) {
      // Deliberately after the row, and deliberately not fatal. The row is what
      // the user asked to remove and it is already gone, so a storage failure
      // must not report the delete as having failed — it would invite a retry
      // against an item that no longer exists. What it leaves behind is an
      // orphaned object, which costs storage and nothing else.
      try {
        await deleteObject(fileKey);
      } catch (error) {
        console.error('Item %s was deleted but its file %s was not:', itemId, fileKey, error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Could not delete the item:', error);

    return { success: false, error: 'Could not delete this item. Please try again.' };
  }
}
