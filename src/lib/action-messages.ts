import { z } from 'zod';

/**
 * The messages and failure shapes the server actions share.
 *
 * They live here rather than in `src/actions` because a `'use server'` module's
 * exports are public endpoints and must be async functions, so a constant
 * cannot be exported from one. Pure, so any action can import it without
 * pulling in the session or the database.
 */

export const SESSION_EXPIRED = 'Your session has expired. Sign in again.';

/** The banner shown beside any per-field message. */
export const CHECK_FIELDS = 'Check the highlighted fields and try again.';

export interface FieldErrorResult {
  success: false;
  error: string;
  fieldErrors: Record<string, string[]>;
}

/** One field refused with one message, under the usual banner. */
export function fieldError(field: string, message: string): FieldErrorResult {
  return { success: false, error: CHECK_FIELDS, fieldErrors: { [field]: [message] } };
}

/**
 * A payload that failed its schema. Zod groups the messages on the first path
 * segment, so one pathed at `tags.0` still lands on the `tags` field the form
 * renders.
 */
export function invalidFields(error: z.ZodError): FieldErrorResult {
  return { success: false, error: CHECK_FIELDS, fieldErrors: z.flattenError(error).fieldErrors };
}
