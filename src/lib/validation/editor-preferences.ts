import { z } from 'zod';

import {
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEMES,
} from '@/lib/editor-preferences';

/**
 * What a write must be.
 *
 * Strict, unlike `parseEditorPreferences`, which reads the same shape back out
 * of the JSON column and falls back per field. The two are different jobs: a
 * stored value that no longer parses is the app's problem to absorb, while a
 * caller posting a font size that is not on the menu is a bad request. This is
 * a server action, so anyone can post to it — silently rewriting an
 * out-of-range value to the default would store something the caller never
 * asked for and report success.
 *
 * The allowed values come from the same arrays the dropdowns render, so a size
 * added to the menu is accepted here without a second edit.
 */
export const editorPreferencesSchema = z.object({
  fontSize: z.literal(EDITOR_FONT_SIZES),
  tabSize: z.literal(EDITOR_TAB_SIZES),
  wordWrap: z.boolean(),
  minimap: z.boolean(),
  theme: z.literal(EDITOR_THEMES.map((theme) => theme.id)),
});

/** What the server action hands the query function, after validation. */
export type EditorPreferencesData = z.output<typeof editorPreferencesSchema>;
