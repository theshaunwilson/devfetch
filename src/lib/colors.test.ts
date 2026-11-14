import { describe, expect, it } from 'vitest';

import {
  ITEM_TYPE_ACCENTS,
  borderColorClass,
  softBgColorClass,
  textColorClass,
} from './colors';

describe('textColorClass', () => {
  it('maps a stored type key to its token utility', () => {
    expect(textColorClass(ITEM_TYPE_ACCENTS.prompt)).toBe('text-type-prompt');
  });

  it('falls back for a key it does not know', () => {
    expect(textColorClass('#123456')).toBe('text-muted-foreground');
  });

  it('falls back for null and undefined, since ItemType.color is nullable', () => {
    expect(textColorClass(null)).toBe('text-muted-foreground');
    expect(textColorClass(undefined)).toBe('text-muted-foreground');
  });
});

describe('borderColorClass', () => {
  it('maps a stored type key to its left-border utility', () => {
    expect(borderColorClass(ITEM_TYPE_ACCENTS.link)).toBe('border-l-type-link');
  });

  it('falls back for an unknown key and for null', () => {
    expect(borderColorClass('#000000')).toBe('border-l-border');
    expect(borderColorClass(null)).toBe('border-l-border');
  });
});

describe('softBgColorClass', () => {
  it('maps a stored type key to its tinted background utility', () => {
    expect(softBgColorClass(ITEM_TYPE_ACCENTS.command)).toBe('bg-type-command/10');
  });

  it('falls back for an unknown key and for null', () => {
    expect(softBgColorClass('#ffffff')).toBe('bg-muted');
    expect(softBgColorClass(null)).toBe('bg-muted');
  });
});

describe('the three maps', () => {
  // A type that resolved in one map and fell back in another would render a
  // tinted icon inside a default-bordered card. Each type also has to land on
  // its own token, or two types would share a colour.
  it.each(Object.entries(ITEM_TYPE_ACCENTS))('resolves %s to its own token in all three', (slug, key) => {
    expect(textColorClass(key)).toBe(`text-type-${slug}`);
    expect(borderColorClass(key)).toBe(`border-l-type-${slug}`);
    expect(softBgColorClass(key)).toBe(`bg-type-${slug}/10`);
  });

  it('gives every type a distinct stored key', () => {
    const keys = Object.values(ITEM_TYPE_ACCENTS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
