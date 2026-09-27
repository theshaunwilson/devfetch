'use server';

import { z } from 'zod';

import { SESSION_EXPIRED } from '@/lib/action-messages';
import { saveEditorPreferences } from '@/lib/db/user';
import { editorPreferencesSchema } from '@/lib/validation/editor-preferences';
import type { EditorPreferences } from '@/types/editor';

export interface UpdateEditorPreferencesResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Writes the signed-in user's editor preferences.
 *
 * Takes a plain object rather than `FormData`, unlike the other actions here:
 * there is no form and no submit button — the settings controls save
 * themselves when they change, so what arrives is already a value, not a set
 * of form fields.
 *
 * The whole set is sent every time rather than the one field that moved. It
 * keeps the write idempotent and the validation total, and it costs nothing:
 * five small values against a column that is replaced either way.
 *
 * The owner comes from the session inside `saveEditorPreferences`, never from
 * the payload — a server action is a public endpoint, so the only thing that
 * says whose preferences these are is the JWT.
 */
export async function updateEditorPreferences(
  preferences: EditorPreferences,
): Promise<UpdateEditorPreferencesResult> {
  const parsed = editorPreferencesSchema.safeParse(preferences);

  // Strict on the way in, unlike the read path, which falls back per field.
  // A caller sending a value that is not on the menu is told so rather than
  // having it quietly become the default and reported as saved.
  if (!parsed.success) {
    return {
      success: false,
      error: 'Those editor preferences are not valid.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const saved = await saveEditorPreferences(parsed.data);

    if (!saved) {
      return { success: false, error: SESSION_EXPIRED };
    }
  } catch (error) {
    console.error('Could not save the editor preferences:', error);

    return { success: false, error: 'Could not save your preferences. Please try again.' };
  }

  // Deliberately no `revalidatePath`. Nothing server-rendered draws these —
  // the editors read them from context on the client — so a refresh here
  // would re-run the shell's queries to change nothing on the page.
  return { success: true };
}
