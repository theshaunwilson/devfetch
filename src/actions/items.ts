'use server';

import { auth } from '@/auth';
import { SESSION_EXPIRED, fieldError, invalidFields } from '@/lib/action-messages';
import { isProUser } from '@/lib/db/billing';
import { getOwnedCollectionIds } from '@/lib/db/collections';
import { getItemTypeById } from '@/lib/db/item-types';
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  setItemFavorite as setItemFavoriteRow,
  setItemPinned as setItemPinnedRow,
  updateItem as updateItemRow,
  updateItemContent as updateItemContentRow,
} from '@/lib/db/items';
import { requiredFieldsFor } from '@/lib/items';
import { deleteObject } from '@/lib/r2';
import { setFlag } from '@/lib/set-flag';
import { keyBelongsTo } from '@/lib/uploads';
import { limitMessage } from '@/lib/usage-limits';
import { createItemSchema, updateItemContentSchema, updateItemSchema } from '@/lib/validation/items';
import type { CreateItemInput, UpdateItemInput } from '@/lib/validation/items';
import type {
  CreateItemResult,
  DeleteItemResult,
  SetItemFavoriteResult,
  SetItemPinnedResult,
  UpdateItemResult,
} from '@/types/item';

const FOREIGN_COLLECTIONS = fieldError('collectionIds', 'Pick collections from your own list');

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
    return { success: false, error: SESSION_EXPIRED };
  }

  const parsed = createItemSchema.safeParse(data);

  if (!parsed.success) {
    return invalidFields(parsed.error);
  }

  try {
    const type = await getItemTypeById(parsed.data.typeId);

    if (!type) {
      // An unknown type and one belonging to somebody else read the same way.
      return fieldError('typeId', 'Choose an item type');
    }

    const required = requiredFieldsFor(type.slug);
    // One request-cached lookup, read once and used by both the upload gate
    // below and the item ceiling inside the write.
    const isPro = await isProUser();

    if (required.url && !parsed.data.url) {
      return fieldError('url', 'URL is required');
    }

    if (required.file) {
      // The second of the upload gate's two doors. `POST /api/uploads` is
      // where the R2 spend happens and refuses first, but this is what writes
      // the row that references an object — so a caller holding a key from
      // before the gate existed, or from a lapsed Pro subscription, still
      // cannot file a new item against it.
      if (!isPro) {
        return {
          success: false,
          error: 'File and image uploads are a Pro feature. Upgrade to add them.',
          upgradeRequired: true,
        };
      }

      const { fileUrl, fileName, fileSize } = parsed.data;

      if (!fileUrl || !fileName || !fileSize) {
        return fieldError('fileUrl', 'Upload a file');
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
        return fieldError('fileUrl', 'Upload the file again');
      }
    }

    const collections = await resolveCollectionIds(parsed.data.collectionIds);

    if (!collections.ok) {
      return FOREIGN_COLLECTIONS;
    }

    // The resolved ids rather than the ones that arrived, so what is written is
    // what was checked — for the type and the collections alike. `contentType`
    // is decided here from the resolved slug rather than taken from the payload,
    // so a text item cannot claim to be a file — or the other way round.
    //
    // The file fields follow the same rule. The schema accepts them for every
    // type, and the key and Pro checks above run only for a type that takes a
    // file — so for any other type they would reach the row unchecked, and a
    // snippet naming somebody else's key could then read that object through
    // `/api/files/[id]` and delete it through `deleteItem`.
    const fileFields = required.file
      ? {}
      : { fileUrl: null, fileName: null, fileSize: null };

    const outcome = await createItemRow(
      { ...parsed.data, ...fileFields, typeId: type.id, collectionIds: collections.ids },
      required.file ? 'file' : 'text',
      isPro,
    );

    if (!outcome.ok) {
      return outcome.reason === 'limit-reached'
        ? { success: false, error: limitMessage('items'), upgradeRequired: true }
        : { success: false, error: SESSION_EXPIRED };
    }

    return { success: true, data: outcome.item };
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
    return { success: false, error: SESSION_EXPIRED };
  }

  const parsed = updateItemSchema.safeParse(data);

  if (!parsed.success) {
    return invalidFields(parsed.error);
  }

  try {
    const collections = await resolveCollectionIds(parsed.data.collectionIds);

    if (!collections.ok) {
      return FOREIGN_COLLECTIONS;
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
 * Replaces one item's content — how an optimized prompt is accepted.
 *
 * Its own action rather than `updateItem` with the title resent: the drawer's
 * read view holds the saved item, not a form, and a write that sends back
 * fields it did not change could overwrite an edit made in another tab. The id
 * is trusted for nothing, as in `updateItem`; the write is scoped to the
 * session's user in `updateItemContent`. Returns the full item, so the drawer
 * refreshes through the same path an edit takes.
 */
export async function updateItemContent(
  itemId: string,
  content: string,
): Promise<UpdateItemResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: SESSION_EXPIRED };
  }

  const parsed = updateItemContentSchema.safeParse({ content });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the content and try again.' };
  }

  try {
    const item = await updateItemContentRow(itemId, parsed.data.content);

    if (!item) {
      return { success: false, error: 'That item could not be found.' };
    }

    return { success: true, data: item };
  } catch (error) {
    console.error('Could not update the item content:', error);

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
    return { success: false, error: SESSION_EXPIRED };
  }

  try {
    const { deleted, fileKey } = await deleteItemRow(itemId);

    if (!deleted) {
      // Somebody else's item reads exactly like one that does not exist.
      return { success: false, error: 'That item could not be found.' };
    }

    // Only a key this user minted. `createItem` no longer writes one on any
    // other terms, but a row from before that check — or from any future path
    // that forgets it — must not be able to delete somebody else's object.
    if (fileKey && !keyBelongsTo(fileKey, session.user.id)) {
      console.warn('Item %s named a file key its owner did not upload; left it alone.', itemId);
    } else if (fileKey) {
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

/**
 * Favorites or unfavorites one item belonging to the signed-in user.
 *
 * Every decision — the value to store rather than a flip, the flag parsed
 * rather than trusted to its type, a row that was not this user's reported like
 * one that never existed — is `setFlag`'s, shared with the pin and the
 * collection favorite. See `setItemFavorite` in `@/lib/db/items` for the
 * ownership filter that makes the id safe to accept.
 */
export async function setItemFavorite(
  itemId: string,
  isFavorite: boolean,
): Promise<SetItemFavoriteResult> {
  return setFlag(itemId, isFavorite, { noun: 'item', label: 'favorite', write: setItemFavoriteRow });
}

/**
 * Pins or unpins one item belonging to the signed-in user, through the same
 * `setFlag` as the favorite above.
 *
 * Named `setItemPinned` rather than the spec's `toggleItemPin` for the reason
 * the favorite actions carry the names they do — the UI is a toggle, the
 * endpoint sets, and a name saying otherwise would be a lie about the contract.
 */
export async function setItemPinned(
  itemId: string,
  isPinned: boolean,
): Promise<SetItemPinnedResult> {
  return setFlag(itemId, isPinned, { noun: 'item', label: 'pin', write: setItemPinnedRow });
}
