/**
 * Maps the free text in `Item.language` onto a Monaco language id.
 *
 * The field is whatever the user typed — "bash", "TypeScript", "c++" — while
 * Monaco's `language` prop takes a registered **id**. The two disagree more
 * often than they agree: Monaco's id for bash is `shell`, and `bash` is not
 * even one of its aliases, so the five seeded items written in bash would
 * render with no highlighting at all without this.
 *
 * Monaco's own aliases are not usable directly either — `ts`, `py` and `sh`
 * are aliases, which the mode service does not resolve when creating a model —
 * so the ones worth typing are listed here as ids.
 */

/**
 * Anything a developer might reasonably type that is not already a Monaco id.
 *
 * Keys are normalized (trimmed, lowercased); values are real Monaco ids. An
 * id that a user would type unchanged — `python`, `sql`, `rust` — needs no
 * entry, because an unmatched value falls through as itself.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  // Shells. Monaco has one `shell` mode and no `bash` alias at all.
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  ksh: 'shell',
  fish: 'shell',
  'shell script': 'shell',
  console: 'shell',
  terminal: 'shell',
  cmd: 'bat',
  batch: 'bat',
  ps1: 'powershell',
  pwsh: 'powershell',

  // JavaScript and friends.
  js: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  coffee: 'coffeescript',

  // C family. Monaco has one `cpp` mode covering C and C++.
  'c++': 'cpp',
  cxx: 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  'f#': 'fsharp',
  objc: 'objective-c',
  'objective c': 'objective-c',

  // Everything else, roughly by how likely it is to be typed.
  py: 'python',
  python3: 'python',
  rb: 'ruby',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  yml: 'yaml',
  md: 'markdown',
  htm: 'html',
  sass: 'scss',
  postgres: 'pgsql',
  postgresql: 'pgsql',
  psql: 'pgsql',
  pg: 'pgsql',
  sqlite: 'sql',
  tsql: 'sql',
  protobuf: 'proto',
  solidity: 'sol',
  terraform: 'hcl',
  tf: 'hcl',
  vim: 'plaintext',
  make: 'plaintext',
  makefile: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
  none: 'plaintext',
  gql: 'graphql',
  hbs: 'handlebars',
  jade: 'pug',
  pl: 'perl',
  vb: 'vb',
  docker: 'dockerfile',
};

/** Monaco's own id for "no highlighting", and its default. */
export const PLAINTEXT = 'plaintext';

/**
 * The Monaco language id for an item's language, or plaintext when it has none.
 *
 * A value that matches no alias is passed through as-is rather than rejected:
 * most Monaco ids are exactly what a user would type, and Monaco falls back to
 * plaintext on its own for an id it does not know, so guessing costs nothing
 * and covers all 80-odd languages without listing them here.
 */
export function monacoLanguage(language: string | null | undefined): string {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) return PLAINTEXT;

  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

/**
 * How the language reads in the editor header — the user's own text, not the
 * Monaco id, so a snippet saved as "Bash" does not relabel itself "shell".
 */
export function languageLabel(language: string | null | undefined): string | null {
  return language?.trim() || null;
}
