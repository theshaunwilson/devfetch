/**
 * `parseEditorPreferences` is the only thing standing between a JSON column
 * Postgres does not constrain and the options handed to Monaco. What is pinned
 * here is that it falls back *per field* — a single unusable value must not
 * cost the user the other four — and that it cannot throw, because the same
 * call decides whether an editor renders at all.
 *
 * Pure module, so nothing is mocked.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EDITOR_PREFERENCES,
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEMES,
  editorLineHeight,
  parseEditorPreferences,
} from './editor-preferences';

describe('the values on offer', () => {
  // A default that is not one of the options renders a select with nothing
  // selected, which reads as the setting being broken rather than unset.
  it('offers every default as a choice', () => {
    expect(EDITOR_FONT_SIZES).toContain(DEFAULT_EDITOR_PREFERENCES.fontSize);
    expect(EDITOR_TAB_SIZES).toContain(DEFAULT_EDITOR_PREFERENCES.tabSize);
    expect(EDITOR_THEMES.map((theme) => theme.id)).toContain(DEFAULT_EDITOR_PREFERENCES.theme);
  });

  it('keeps the spec defaults: wrap on, minimap off', () => {
    expect(DEFAULT_EDITOR_PREFERENCES.wordWrap).toBe(true);
    expect(DEFAULT_EDITOR_PREFERENCES.minimap).toBe(false);
  });

  it('offers no duplicates, which would render two identical options', () => {
    expect(new Set(EDITOR_FONT_SIZES).size).toBe(EDITOR_FONT_SIZES.length);
    expect(new Set(EDITOR_TAB_SIZES).size).toBe(EDITOR_TAB_SIZES.length);
    expect(new Set(EDITOR_THEMES.map((theme) => theme.id)).size).toBe(EDITOR_THEMES.length);
  });
});

describe('editorLineHeight', () => {
  // The editor had a hardcoded 20 before the font size was configurable, so
  // this is the line that says an existing user sees no change.
  it('reproduces the height the editor had at the default size', () => {
    expect(editorLineHeight(DEFAULT_EDITOR_PREFERENCES.fontSize)).toBe(20);
  });

  it('grows with the font size, so large text is not boxed in', () => {
    const heights = EDITOR_FONT_SIZES.map(editorLineHeight);

    for (const [index, height] of heights.entries()) {
      expect(height).toBeGreaterThan(EDITOR_FONT_SIZES[index]);

      if (index > 0) expect(height).toBeGreaterThan(heights[index - 1]);
    }
  });

  it('is a whole number of pixels', () => {
    for (const size of EDITOR_FONT_SIZES) {
      expect(Number.isInteger(editorLineHeight(size))).toBe(true);
    }
  });
});

describe('parseEditorPreferences', () => {
  it('takes a stored set back unchanged', () => {
    const stored = {
      fontSize: 16,
      tabSize: 8,
      wordWrap: false,
      minimap: true,
      theme: 'monokai',
    };

    expect(parseEditorPreferences(stored)).toEqual(stored);
  });

  // The column is nullable, and null is what every account has until it opens
  // settings — so this is the common case, not an edge one.
  it('gives the defaults for a column that was never written', () => {
    expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it.each([
    ['undefined', undefined],
    ['a string', '{"fontSize":16}'],
    ['a number', 12],
    ['an array', [{ fontSize: 16 }]],
  ])('gives the defaults for %s rather than throwing', (_label, value) => {
    expect(() => parseEditorPreferences(value)).not.toThrow();
    expect(parseEditorPreferences(value)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  // The point of falling back per field rather than all at once: one value
  // written by an older shape must not cost the other four.
  it('keeps the usable fields when one is not usable', () => {
    const result = parseEditorPreferences({
      fontSize: 999,
      tabSize: 4,
      wordWrap: false,
      minimap: true,
      theme: 'monokai',
    });

    expect(result).toEqual({
      fontSize: DEFAULT_EDITOR_PREFERENCES.fontSize,
      tabSize: 4,
      wordWrap: false,
      minimap: true,
      theme: 'monokai',
    });
  });

  it('fills in a field that is missing entirely', () => {
    const result = parseEditorPreferences({ fontSize: 14 });

    expect(result).toEqual({ ...DEFAULT_EDITOR_PREFERENCES, fontSize: 14 });
  });

  it('refuses a theme it does not offer', () => {
    expect(parseEditorPreferences({ theme: 'hacker' }).theme).toBe(
      DEFAULT_EDITOR_PREFERENCES.theme,
    );
  });

  // Coercing would store an intent nobody expressed, and leave a toggle stuck
  // in a state the user cannot explain from what they clicked.
  it.each([
    ['a string', 'true'],
    ['a number', 1],
    ['null', null],
  ])('does not coerce %s into a boolean', (_label, value) => {
    const result = parseEditorPreferences({ wordWrap: value, minimap: value });

    expect(result.wordWrap).toBe(DEFAULT_EDITOR_PREFERENCES.wordWrap);
    expect(result.minimap).toBe(DEFAULT_EDITOR_PREFERENCES.minimap);
  });

  it('takes false as a choice, not as a missing value', () => {
    expect(parseEditorPreferences({ wordWrap: false }).wordWrap).toBe(false);
  });

  it('accepts every value the dropdowns can produce', () => {
    for (const fontSize of EDITOR_FONT_SIZES) {
      expect(parseEditorPreferences({ fontSize }).fontSize).toBe(fontSize);
    }

    for (const tabSize of EDITOR_TAB_SIZES) {
      expect(parseEditorPreferences({ tabSize }).tabSize).toBe(tabSize);
    }

    for (const { id } of EDITOR_THEMES) {
      expect(parseEditorPreferences({ theme: id }).theme).toBe(id);
    }
  });

  it('ignores fields that are not preferences', () => {
    const result = parseEditorPreferences({ fontSize: 14, isPro: true, password: 'x' });

    expect(result).toEqual({ ...DEFAULT_EDITOR_PREFERENCES, fontSize: 14 });
    expect(Object.keys(result).sort()).toEqual(Object.keys(DEFAULT_EDITOR_PREFERENCES).sort());
  });
});
