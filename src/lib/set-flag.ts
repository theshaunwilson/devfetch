import 'server-only';

import { z } from 'zod';

import { auth } from '@/auth';
import { SESSION_EXPIRED } from '@/lib/action-messages';
import type { ActionResult } from '@/types/action';

interface FlagWrite {
  /** What the row is, as the user reads it — "item" or "collection". */
  noun: string;
  /** Which flag, as it appears in the server log — "favorite" or "pin". */
  label: string;
  /** The scoped write. False when no row of this user's matched the id. */
  write: (id: string, value: boolean) => Promise<boolean>;
}

/**
 * Sets one boolean flag on one row belonging to the signed-in user — how every
 * favorite and pin toggle is saved.
 *
 * Here rather than in `src/actions` because it takes a function, and a
 * `'use server'` module's exports are public endpoints. The actions call it;
 * it is never one itself.
 *
 * Takes the value to store rather than flipping whatever is in the row: the
 * user clicked a control that was showing them a particular state, and
 * honouring that is both idempotent and one statement. The ownership filter
 * that makes the id safe to accept lives in the write itself.
 *
 * The flag is parsed rather than trusted to its type. A server action is a
 * public endpoint, so the argument is whatever the caller posted — and a
 * non-boolean reaching Prisma is a 500 where it should be a refusal. A row that
 * was not this user's reads exactly like one that never existed.
 */
export async function setFlag(
  id: string,
  value: boolean,
  { noun, label, write }: FlagWrite,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: SESSION_EXPIRED };
  }

  const failed = `Could not update that ${noun}. Please try again.`;
  const parsed = z.boolean().safeParse(value);

  if (!parsed.success) {
    return { success: false, error: failed };
  }

  try {
    const updated = await write(id, parsed.data);

    if (!updated) {
      return { success: false, error: `That ${noun} could not be found.` };
    }

    return { success: true };
  } catch (error) {
    console.error(`Could not update the ${noun} ${label}:`, error);

    return { success: false, error: failed };
  }
}
