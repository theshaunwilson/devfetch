'use server';

import { z } from 'zod';

import { auth } from '@/auth';
import { updateItem as updateItemRow } from '@/lib/db/items';
import { updateItemSchema } from '@/lib/validation/items';
import type { UpdateItemInput } from '@/lib/validation/items';
import type { UpdateItemResult } from '@/types/item';

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
