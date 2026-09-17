'use server';

import { z } from 'zod';

import { auth } from '@/auth';
import {
  createCollection as createCollectionRow,
  deleteCollection as deleteCollectionRow,
  setCollectionFavorite as setCollectionFavoriteRow,
  updateCollection as updateCollectionRow,
} from '@/lib/db/collections';
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

const CHECK_FIELDS = 'Check the highlighted fields and try again.';

/**
 * Creates one collection for the signed-in user and returns it in full.
 *
 * A server action is a public endpoint, so nothing in the payload is trusted:
 * the session decides who is asking and the owner is taken from it, never from
 * the data. See `createCollection` in `@/lib/db/collections`.
 *
 * A duplicate name comes back on the field rather than as a banner alone,
 * because it is the one failure the user can fix by editing what they typed.
 */
export async function createCollection(
  data: CreateCollectionInput
): Promise<CreateCollectionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  const parsed = createCollectionSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: CHECK_FIELDS,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const outcome = await createCollectionRow(parsed.data);

    if (outcome.ok) {
      return { success: true, data: outcome.collection };
    }

    if (outcome.reason === 'duplicate-name') {
      return {
        success: false,
        error: CHECK_FIELDS,
        fieldErrors: { name: ['You already have a collection with that name'] },
      };
    }

    return { success: false, error: 'Your session has expired. Sign in again.' };
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
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  const parsed = updateCollectionSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: CHECK_FIELDS,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const outcome = await updateCollectionRow(collectionId, parsed.data);

    if (outcome.ok) {
      return { success: true };
    }

    if (outcome.reason === 'duplicate-name') {
      return {
        success: false,
        error: CHECK_FIELDS,
        fieldErrors: { name: ['You already have a collection with that name'] },
      };
    }

    if (outcome.reason === 'not-found') {
      return { success: false, error: 'That collection could not be found.' };
    }

    return { success: false, error: 'Your session has expired. Sign in again.' };
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
    return { success: false, error: 'Your session has expired. Sign in again.' };
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
 * Favorites or unfavorites one collection belonging to the signed-in user.
 *
 * Takes the value to store rather than flipping whatever is in the row, for the
 * same reasons `setItemFavorite` does, and parses the flag rather than trusting
 * its type — a server action is a public endpoint and the argument is whatever
 * the caller posted.
 */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetCollectionFavoriteResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  const parsed = z.boolean().safeParse(isFavorite);

  if (!parsed.success) {
    return { success: false, error: 'Could not update that collection. Please try again.' };
  }

  try {
    const updated = await setCollectionFavoriteRow(collectionId, parsed.data);

    if (!updated) {
      // Somebody else's collection reads exactly like one that does not exist.
      return { success: false, error: 'That collection could not be found.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Could not update the collection favorite:', error);

    return { success: false, error: 'Could not update that collection. Please try again.' };
  }
}
