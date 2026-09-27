'use server';

import { auth } from '@/auth';
import { SESSION_EXPIRED, fieldError, invalidFields } from '@/lib/action-messages';
import { isProUser } from '@/lib/db/billing';
import {
  createCollection as createCollectionRow,
  deleteCollection as deleteCollectionRow,
  setCollectionFavorite as setCollectionFavoriteRow,
  updateCollection as updateCollectionRow,
} from '@/lib/db/collections';
import { setFlag } from '@/lib/set-flag';
import { limitMessage } from '@/lib/usage-limits';
import { createCollectionSchema, updateCollectionSchema } from '@/lib/validation/collections';
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from '@/lib/validation/collections';
import type {
  CreateCollectionResult,
  DeleteCollectionResult,
  SetCollectionFavoriteResult,
  UpdateCollectionResult,
} from '@/types/collection';

/**
 * The one failure the user can fix by editing what they typed, so it comes back
 * on the field rather than as a banner alone — for a create and a rename alike.
 */
const DUPLICATE_NAME = fieldError('name', 'You already have a collection with that name');

/**
 * Creates one collection for the signed-in user and returns it in full.
 *
 * A server action is a public endpoint, so nothing in the payload is trusted:
 * the session decides who is asking and the owner is taken from it, never from
 * the data. See `createCollection` in `@/lib/db/collections`.
 */
export async function createCollection(
  data: CreateCollectionInput
): Promise<CreateCollectionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: SESSION_EXPIRED };
  }

  const parsed = createCollectionSchema.safeParse(data);

  if (!parsed.success) {
    return invalidFields(parsed.error);
  }

  try {
    const outcome = await createCollectionRow(parsed.data, await isProUser());

    if (outcome.ok) {
      return { success: true, data: outcome.collection };
    }

    if (outcome.reason === 'duplicate-name') {
      return DUPLICATE_NAME;
    }

    // Not a field error: nothing the user typed is wrong, and the dialog keeps
    // what they typed either way — the fix is to upgrade or free one up.
    if (outcome.reason === 'limit-reached') {
      return { success: false, error: limitMessage('collections'), upgradeRequired: true };
    }

    return { success: false, error: SESSION_EXPIRED };
  } catch (error) {
    console.error('Could not create the collection:', error);

    return { success: false, error: 'Could not create this collection. Please try again.' };
  }
}

/**
 * Edits one collection's metadata for the signed-in user.
 *
 * The id is an argument rather than a payload field, as it is for `updateItem`:
 * it addresses the row, and the ownership filter in the query's own `where`
 * clause is what stands between it and somebody else's collection.
 */
export async function updateCollection(
  collectionId: string,
  data: UpdateCollectionInput
): Promise<UpdateCollectionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: SESSION_EXPIRED };
  }

  const parsed = updateCollectionSchema.safeParse(data);

  if (!parsed.success) {
    return invalidFields(parsed.error);
  }

  try {
    const outcome = await updateCollectionRow(collectionId, parsed.data);

    if (outcome.ok) {
      return { success: true };
    }

    if (outcome.reason === 'duplicate-name') {
      return DUPLICATE_NAME;
    }

    if (outcome.reason === 'not-found') {
      return { success: false, error: 'That collection could not be found.' };
    }

    return { success: false, error: SESSION_EXPIRED };
  } catch (error) {
    console.error('Could not update the collection:', error);

    return { success: false, error: 'Could not save this collection. Please try again.' };
  }
}

/**
 * Deletes one collection belonging to the signed-in user.
 *
 * The items it held survive — see `deleteCollection` in `@/lib/db/collections`,
 * where the cascade that makes that true is spelled out. Nothing comes back on
 * success: the caller either navigates away from the page it was showing or
 * refreshes the list it was in.
 */
export async function deleteCollection(collectionId: string): Promise<DeleteCollectionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: SESSION_EXPIRED };
  }

  try {
    const deleted = await deleteCollectionRow(collectionId);

    if (!deleted) {
      // Somebody else's collection reads exactly like one that does not exist.
      return { success: false, error: 'That collection could not be found.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Could not delete the collection:', error);

    return { success: false, error: 'Could not delete this collection. Please try again.' };
  }
}

/**
 * Favorites or unfavorites one collection belonging to the signed-in user,
 * through the same `setFlag` as `setItemFavorite` and for the same reasons.
 */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetCollectionFavoriteResult> {
  return setFlag(collectionId, isFavorite, {
    noun: 'collection',
    label: 'favorite',
    write: setCollectionFavoriteRow,
  });
}
