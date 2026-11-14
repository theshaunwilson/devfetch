import type { EditorPreferences, EditorThemeId } from '@/types/editor';

/**
 * Editor preferences: the values on offer, the defaults, and how an unknown
 * value out of the database becomes a usable set.
 *
 * No `server-only` — the settings controls and the editor itself both read
 * this on the client, and so does the server action that validates a write.
 */

/**
 * The font sizes the dropdown offers.
 *
 * 12 is first because it is what the editor rendered at before this was
 * configurable, and it is the default, so an existing user sees no change.
 */
export const EDITOR_FONT_SIZES = [12, 13, 14, 16] as const satisfies readonly EditorPreferences['fontSize'][];

/** The tab widths the dropdown offers. 2 is the previous hardcoded value. */
export const EDITOR_TAB_SIZES = [2, 4, 8] as const satisfies readonly EditorPreferences['tabSize'][];

/** The themes the dropdown offers, with the labels it shows for them. */
export const EDITOR_THEMES = [
  { id: 'vs-dark', label: 'DevFetch Dark' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'github-dark', label: 'GitHub Dark' },
] as const satisfies readonly { id: EditorThemeId; label: string }[];

/**
 * What an account gets before it has ever opened settings, and what any field
 * falls back to when the stored value cannot be used.
 *
 * `wordWrap` on and `minimap` off are the spec's defaults. Word wrap is a
 * change from what the editor did before — long lines used to scroll
 * horizontally — so it is the one default here that an existing user will
 * notice without having chosen anything.
 */
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 12,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  theme: 'vs-dark',
};

/**
 * Line height as a multiple of the font size.
 *
 * 5/3 rather than a fixed number of pixels, because the size is now the user's
 * to choose and a 20px line box around 16px text would be cramped. The ratio
 * is the one the editor already had: 12 × 5/3 is exactly the 20 that was
 * hardcoded, so the default size renders identically to before.
 */
const LINE_HEIGHT_RATIO = 5 / 3;

/** The line height to give Monaco for a font size. */
export function editorLineHeight(fontSize: number): number {
  return Math.round(fontSize * LINE_HEIGHT_RATIO);
}

/**
 * Turns whatever is in the JSON column into a usable set of preferences.
 *
 * Deliberately tolerant, and per field. `User.editorPreferences` is a JSON
 * column, so Postgres constrains nothing about it: a row written by an older
 * shape of this feature, or edited by hand, reads back as anything at all. A
 * single unusable field must not cost the user the other four, and nothing
 * here should be able to stop an editor rendering — so every field that does
 * not match the values on offer falls back to its default.
 *
 * The strict counterpart is `editorPreferencesSchema`, which a *write* goes
 * through: a caller sending a font size that is not on the menu is a bad
 * request and is told so, rather than having it quietly become 12.
 */
export function parseEditorPreferences(value: unknown): EditorPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const stored = value as Record<string, unknown>;

  return {
    fontSize: oneOf(EDITOR_FONT_SIZES, stored.fontSize, DEFAULT_EDITOR_PREFERENCES.fontSize),
    tabSize: oneOf(EDITOR_TAB_SIZES, stored.tabSize, DEFAULT_EDITOR_PREFERENCES.tabSize),
    wordWrap: boolOr(stored.wordWrap, DEFAULT_EDITOR_PREFERENCES.wordWrap),
    minimap: boolOr(stored.minimap, DEFAULT_EDITOR_PREFERENCES.minimap),
    theme: oneOf(
      EDITOR_THEMES.map((theme) => theme.id),
      stored.theme,
      DEFAULT_EDITOR_PREFERENCES.theme,
    ),
  };
}

/** The value if it is one of the allowed ones, otherwise the fallback. */
function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Booleans are taken only as booleans. A stored `"true"` is not coerced: it
 * means something wrote the wrong shape, and guessing at intent there is how a
 * setting ends up stuck on a value the user cannot explain.
 */
function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
