/**
 * The editor preferences a user can set, as stored in `User.editorPreferences`
 * and as handed to Monaco.
 *
 * The allowed values are literal unions rather than `number`/`string` because
 * this shape is read back out of a JSON column, which Postgres does not
 * constrain — anything could be in there. `parseEditorPreferences` is what
 * turns an unknown value into one of these, and the unions are what stop a
 * stray `fontSize: 400` typechecking on the way to Monaco.
 *
 * The lists themselves live in `@/lib/editor-preferences`, which declares them
 * `as const` and `satisfies` these unions, so the two cannot drift. The type
 * does not import them: in this codebase `lib` imports from `types` and never
 * the other way round.
 */
export interface EditorPreferences {
  fontSize: 12 | 13 | 14 | 16;
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  minimap: boolean;
  theme: EditorThemeId;
}

/**
 * Which theme the editor renders in.
 *
 * Only `vs-dark` is a theme Monaco ships. Monaco has exactly four built in —
 * `vs`, `vs-dark`, `hc-black`, `hc-light` — so Monokai and GitHub Dark are
 * defined by hand in `@/lib/monaco`, and `vs-dark` there means vs-dark's token
 * colours over the app's own surfaces rather than VS Code's.
 */
export type EditorThemeId = 'vs-dark' | 'monokai' | 'github-dark';
