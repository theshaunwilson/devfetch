'use server';

import { z } from 'zod';

import { auth } from '@/auth';
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemTypeById,
  updateItem as updateItemRow,
} from '@/lib/db/items';
import { requiredFieldsFor } from '@/lib/items';
import { createItemSchema, updateItemSchema } from '@/lib/validation/items';
import type { CreateItemInput, UpdateItemInput } from '@/lib/validation/items';
import type { CreateItemResult, DeleteItemResult, UpdateItemResult } from '@/types/item';

/**
 * Creates one item for the signed-in user and returns it in full.
 *
 * Two things arriving from the client are not trusted with anything until they
 * have been checked. The owner is never among them — it comes from the session
 * — and the type id is resolved against the types this user can actually see,
 * so an item cannot be filed under somebody else's custom type.
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

    if (requiredFieldsFor(type.slug).url && !parsed.data.url) {
      return {
        success: false,
        error: 'Check the highlighted fields and try again.',
        fieldErrors: { url: ['URL is required'] },
      };
    }

    // The resolved id rather than the one that arrived, so what is written is
    // what was checked.
    const item = await createItemRow({ ...parsed.data, typeId: type.id });

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
    const item = await updateItemRow(itemId, parsed.data);

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
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  try {
    const deleted = await deleteItemRow(itemId);

    if (!deleted) {
      // Somebody else's item reads exactly like one that does not exist.
      return { success: false, error: 'That item could not be found.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Could not delete the item:', error);

    return { success: false, error: 'Could not delete this item. Please try again.' };
  }
}
