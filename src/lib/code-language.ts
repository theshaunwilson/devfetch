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

export interface LanguageOption {
  /** What is stored in `Item.language`. Resolves through `monacoLanguage`. */
  value: string;
  /** What the dropdown shows. */
  label: string;
}

/**
 * The languages offered by the dropdown on the create and edit forms.
 *
 * Values are what gets stored, so they are the lowercase text a user would
 * have typed before the dropdown existed — `bash` rather than Monaco's
 * `shell` — which keeps new items consistent with the seeded ones. Every
 * value resolves to a registered Monaco id, which a test pins.
 */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'dart', label: 'Dart' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'hcl', label: 'HCL' },
  { value: 'html', label: 'HTML' },
  { value: 'ini', label: 'INI' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'less', label: 'Less' },
  { value: 'lua', label: 'Lua' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'perl', label: 'Perl' },
  { value: 'php', label: 'PHP' },
  { value: 'pgsql', label: 'PostgreSQL' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'python', label: 'Python' },
  { value: 'r', label: 'R' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scala', label: 'Scala' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
];

/**
 * The option that stands for a stored language, matched on its value or its
 * label ignoring case and padding — so `Bash` and `TypeScript`, typed before
 * the dropdown existed, select `bash` and `typescript`. Null when it matches
 * none, or when there is no language at all.
 */
export function findLanguageOption(language: string | null | undefined): LanguageOption | null {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) return null;

  return (
    LANGUAGE_OPTIONS.find(
      (option) => option.value === normalized || option.label.toLowerCase() === normalized,
    ) ?? null
  );
}

/**
 * The dropdown's options for a stored language: the fixed list, with the
 * stored text prepended when it matches none of it.
 *
 * Without that extra row an item saved as `zsh` would open with nothing
 * selected, and the value would only survive by accident. With it, the item
 * shows what it holds and round-trips unchanged unless the user picks again.
 */
export function languageSelectOptions(
  language: string | null | undefined,
): readonly LanguageOption[] {
  const trimmed = language?.trim();

  if (!trimmed || findLanguageOption(trimmed)) return LANGUAGE_OPTIONS;

  return [{ value: trimmed, label: trimmed }, ...LANGUAGE_OPTIONS];
}
