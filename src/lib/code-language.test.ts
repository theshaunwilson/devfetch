import { describe, expect, it } from 'vitest';

import {
  LANGUAGE_OPTIONS,
  PLAINTEXT,
  findLanguageOption,
  languageLabel,
  languageSelectOptions,
  monacoLanguage,
} from '@/lib/code-language';

describe('monacoLanguage', () => {
  it('falls back to plaintext when the item has no language', () => {
    expect(monacoLanguage(null)).toBe(PLAINTEXT);
    expect(monacoLanguage(undefined)).toBe(PLAINTEXT);
    expect(monacoLanguage('')).toBe(PLAINTEXT);
    expect(monacoLanguage('   ')).toBe(PLAINTEXT);
  });

  // The reason this module exists: Monaco's id for bash is `shell`, and
  // `bash` is not even one of its aliases, so the seeded bash items would
  // render unhighlighted without the map.
  it('maps bash onto shell, which is what Monaco actually registers', () => {
    expect(monacoLanguage('bash')).toBe('shell');
    expect(monacoLanguage('zsh')).toBe('shell');
    expect(monacoLanguage('sh')).toBe('shell');
  });

  it('normalizes case and surrounding whitespace before matching', () => {
    expect(monacoLanguage('Bash')).toBe('shell');
    expect(monacoLanguage('  BASH  ')).toBe('shell');
    expect(monacoLanguage('TypeScript')).toBe('typescript');
  });

  // Monaco registers these as aliases, which the mode service does not resolve
  // when creating a model — only ids work, so they have to be mapped.
  it('resolves the short forms a developer would type to real ids', () => {
    expect(monacoLanguage('ts')).toBe('typescript');
    expect(monacoLanguage('js')).toBe('javascript');
    expect(monacoLanguage('py')).toBe('python');
    expect(monacoLanguage('rb')).toBe('ruby');
    expect(monacoLanguage('yml')).toBe('yaml');
    expect(monacoLanguage('golang')).toBe('go');
    expect(monacoLanguage('c++')).toBe('cpp');
    expect(monacoLanguage('c#')).toBe('csharp');
  });

  it('passes an unmapped value through, so Monaco ids need no entry', () => {
    expect(monacoLanguage('python')).toBe('python');
    expect(monacoLanguage('dockerfile')).toBe('dockerfile');
    expect(monacoLanguage('rust')).toBe('rust');
  });

  it('passes an unknown language through rather than guessing at it', () => {
    // Monaco falls back to no highlighting on its own for an id it does not
    // know, so this is a safe answer rather than a wrong one.
    expect(monacoLanguage('brainfuck')).toBe('brainfuck');
  });

  it('never returns an empty id, whatever it is handed', () => {
    for (const value of ['', ' ', '\n', '\t ']) {
      expect(monacoLanguage(value)).toBe(PLAINTEXT);
    }
  });
});

describe('languageLabel', () => {
  // The header shows what the user wrote, not the Monaco id: a snippet saved
  // as "Bash" should not relabel itself "shell".
  it('keeps the user text as typed', () => {
    expect(languageLabel('Bash')).toBe('Bash');
    expect(languageLabel('TypeScript')).toBe('TypeScript');
  });

  it('trims, so stray whitespace does not render as a label', () => {
    expect(languageLabel('  bash  ')).toBe('bash');
  });

  it('is null when there is nothing to show', () => {
    expect(languageLabel(null)).toBeNull();
    expect(languageLabel(undefined)).toBeNull();
    expect(languageLabel('')).toBeNull();
    expect(languageLabel('   ')).toBeNull();
  });
});

// The ids monaco-editor 0.56 registers, as shipped in `public/monaco`. An id
// Monaco does not know renders as plaintext with no error, so a typo in the
// dropdown's list would only show up as missing colours.
const MONACO_IDS = new Set([
  'bat', 'c', 'coffeescript', 'cpp', 'csharp', 'css', 'dart', 'dockerfile',
  'elixir', 'fsharp', 'go', 'graphql', 'hcl', 'html', 'ini', 'java',
  'javascript', 'json', 'julia', 'kotlin', 'less', 'lua', 'markdown', 'mysql',
  'objective-c', 'perl', 'pgsql', 'php', 'powershell', 'python', 'r', 'ruby',
  'rust', 'scala', 'scss', 'shell', 'sql', 'swift', 'typescript', 'xml', 'yaml',
]);

describe('LANGUAGE_OPTIONS', () => {
  it('only offers languages Monaco actually highlights', () => {
    for (const option of LANGUAGE_OPTIONS) {
      expect(MONACO_IDS, option.value).toContain(monacoLanguage(option.value));
    }
  });

  // Stored values are what the user would have typed, so a new bash item
  // saves as `bash` like the seeded ones rather than Monaco's `shell`.
  it('stores bash as bash, not as the Monaco id', () => {
    expect(findLanguageOption('bash')?.value).toBe('bash');
    expect(LANGUAGE_OPTIONS.some((option) => option.value === 'shell')).toBe(false);
  });

  it('has no duplicate values', () => {
    const values = LANGUAGE_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
  });
});

describe('findLanguageOption', () => {
  it('matches on the value or the label, ignoring case and padding', () => {
    expect(findLanguageOption('typescript')?.value).toBe('typescript');
    expect(findLanguageOption('TypeScript')?.value).toBe('typescript');
    expect(findLanguageOption('  BASH ')?.value).toBe('bash');
    expect(findLanguageOption('C++')?.value).toBe('cpp');
  });

  it('is null for an unlisted language or none at all', () => {
    expect(findLanguageOption('zsh')).toBeNull();
    expect(findLanguageOption('')).toBeNull();
    expect(findLanguageOption('   ')).toBeNull();
    expect(findLanguageOption(null)).toBeNull();
  });
});

describe('languageSelectOptions', () => {
  it('is the fixed list when the stored language is listed or empty', () => {
    expect(languageSelectOptions('bash')).toBe(LANGUAGE_OPTIONS);
    expect(languageSelectOptions('Bash')).toBe(LANGUAGE_OPTIONS);
    expect(languageSelectOptions('')).toBe(LANGUAGE_OPTIONS);
    expect(languageSelectOptions(null)).toBe(LANGUAGE_OPTIONS);
  });

  // Otherwise an item saved as `zsh` would open with nothing selected.
  it('prepends an unlisted stored language, trimmed, as its own option', () => {
    const options = languageSelectOptions(' zsh ');

    expect(options[0]).toEqual({ value: 'zsh', label: 'zsh' });
    expect(options.slice(1)).toEqual(LANGUAGE_OPTIONS);
  });
});
