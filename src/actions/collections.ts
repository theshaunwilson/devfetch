'use server';

import { z } from 'zod';

import { auth } from '@/auth';
import { createCollection as createCollectionRow } from '@/lib/db/collections';
import { createCollectionSchema } from '@/lib/validation/collections';
import type { CreateCollectionInput } from '@/lib/validation/collections';
import type { CreateCollectionResult } from '@/types/collection';

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
