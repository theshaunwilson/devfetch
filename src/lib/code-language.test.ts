import { describe, expect, it } from 'vitest';

import { PLAINTEXT, languageLabel, monacoLanguage } from '@/lib/code-language';

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
