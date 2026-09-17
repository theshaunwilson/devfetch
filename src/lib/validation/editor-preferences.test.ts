/**
 * The write path is strict where the read path is tolerant, and the pair is
 * the decision worth pinning: the same value that `parseEditorPreferences`
 * quietly replaces with a default must be *refused* here.
 *
 * A server action is a public endpoint, so accepting an out-of-range value and
 * silently storing the default would report success for something the caller
 * never asked for.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EDITOR_PREFERENCES,
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEMES,
  parseEditorPreferences,
} from '@/lib/editor-preferences';
import { editorPreferencesSchema } from './editor-preferences';

const VALID = {
  fontSize: 16,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  theme: 'monokai',
};

describe('editorPreferencesSchema', () => {
  it('accepts a complete, valid set', () => {
    const parsed = editorPreferencesSchema.safeParse(VALID);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(VALID);
  });

  it('accepts the defaults', () => {
    expect(editorPreferencesSchema.safeParse(DEFAULT_EDITOR_PREFERENCES).success).toBe(true);
  });

  it('accepts every combination the dropdowns can produce', () => {
    for (const fontSize of EDITOR_FONT_SIZES) {
      for (const tabSize of EDITOR_TAB_SIZES) {
        for (const { id } of EDITOR_THEMES) {
          const result = editorPreferencesSchema.safeParse({
            ...VALID,
            fontSize,
            tabSize,
            theme: id,
          });

          expect([fontSize, tabSize, id, result.success]).toEqual([fontSize, tabSize, id, true]);
        }
      }
    }
  });

  it.each([
    ['a font size that is not offered', { fontSize: 999 }],
    ['a font size between two that are', { fontSize: 15 }],
    ['a tab size that is not offered', { tabSize: 3 }],
    ['a theme that does not exist', { theme: 'hacker' }],
    ['a theme Monaco has but the app does not offer', { theme: 'hc-black' }],
    ['a stringified number', { fontSize: '16' }],
    ['a stringified boolean', { wordWrap: 'true' }],
  ])('refuses %s', (_label, patch) => {
    expect(editorPreferencesSchema.safeParse({ ...VALID, ...patch }).success).toBe(false);
  });

  it.each(Object.keys(DEFAULT_EDITOR_PREFERENCES))('refuses a set missing %s', (field) => {
    const incomplete: Record<string, unknown> = { ...VALID };
    delete incomplete[field];

    expect(editorPreferencesSchema.safeParse(incomplete).success).toBe(false);
  });

  it.each([
    ['null', null],
    ['a string', 'fontSize=16'],
    ['an array', [VALID]],
  ])('refuses %s outright', (_label, value) => {
    expect(editorPreferencesSchema.safeParse(value).success).toBe(false);
  });

  // The two halves of the same shape, deliberately disagreeing. A value the
  // database is allowed to contain is not a value a caller may send.
  it('refuses what the read path absorbs', () => {
    const outOfRange = { ...VALID, fontSize: 999 };

    expect(editorPreferencesSchema.safeParse(outOfRange).success).toBe(false);
    expect(parseEditorPreferences(outOfRange).fontSize).toBe(DEFAULT_EDITOR_PREFERENCES.fontSize);
  });

  // The error has to say which control was wrong, or the form cannot point at
  // one — the same shape every other action here reports.
  it('names the field that was refused', () => {
    const parsed = editorPreferencesSchema.safeParse({ ...VALID, tabSize: 3 });

    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((issue) => issue.path[0])).toContain('tabSize');
  });
});
