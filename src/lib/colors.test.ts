import { describe, expect, it } from 'vitest';

import {
  ITEM_TYPE_ACCENTS,
  borderColorClass,
  brightTextColorClass,
  softBgColorClass,
  textColorClass,
} from './colors';

describe('textColorClass', () => {
  it('maps a known hex to its Tailwind class', () => {
    expect(textColorClass('#8b5cf6')).toBe('text-violet-500');
  });

  it('falls back for a hex it does not know', () => {
    expect(textColorClass('#123456')).toBe('text-muted-foreground');
  });

  it('falls back for null and undefined, since ItemType.color is nullable', () => {
    expect(textColorClass(null)).toBe('text-muted-foreground');
    expect(textColorClass(undefined)).toBe('text-muted-foreground');
  });
});

describe('brightTextColorClass', () => {
  it('maps a known hex to the brighter tier, not the base one', () => {
    expect(brightTextColorClass('#8b5cf6')).toBe('text-violet-400');
    expect(textColorClass('#8b5cf6')).toBe('text-violet-500');
  });

  it('leaves the two already-light accents where they are', () => {
    // Stepping these to a 400 would make them darker, not brighter.
    expect(brightTextColorClass('#fde047')).toBe('text-yellow-300');
    expect(brightTextColorClass('#e2e8f0')).toBe('text-slate-200');
  });

  it('falls back for an unknown hex and for null', () => {
    expect(brightTextColorClass('#123456')).toBe('text-muted-foreground');
    expect(brightTextColorClass(null)).toBe('text-muted-foreground');
    expect(brightTextColorClass(undefined)).toBe('text-muted-foreground');
  });
});

describe('borderColorClass', () => {
  it('maps a known hex to its left-border class', () => {
    expect(borderColorClass('#10b981')).toBe('border-l-emerald-500');
  });

  it('falls back for an unknown hex and for null', () => {
    expect(borderColorClass('#000000')).toBe('border-l-border');
    expect(borderColorClass(null)).toBe('border-l-border');
  });
});

describe('softBgColorClass', () => {
  it('maps a known hex to its tinted background class', () => {
    expect(softBgColorClass('#f97316')).toBe('bg-orange-500/10');
  });

  it('falls back for an unknown hex and for null', () => {
    expect(softBgColorClass('#ffffff')).toBe('bg-muted');
    expect(softBgColorClass(null)).toBe('bg-muted');
  });
});

describe('the four maps', () => {
  // A type whose colour resolves in one map and falls back in another would
  // render a tinted icon inside a default-bordered card. The accents are read
  // out of ITEM_TYPE_ACCENTS rather than repeated, so a system type added
  // there and forgotten in a map fails here instead of silently going muted.
  const ACCENTS = Object.values(ITEM_TYPE_ACCENTS);

  it.each(ACCENTS)('resolves %s in all four, never a fallback', (hex) => {
    expect(textColorClass(hex)).not.toBe('text-muted-foreground');
    expect(brightTextColorClass(hex)).not.toBe('text-muted-foreground');
    expect(borderColorClass(hex)).not.toBe('border-l-border');
    expect(softBgColorClass(hex)).not.toBe('bg-muted');
  });

  it.each(ACCENTS)('gives %s a bright tier at least as light as its base', (hex) => {
    // Not an equality check: the two already-light accents share a class with
    // the base map, and the rest must differ, but neither may go darker.
    const base = Number(textColorClass(hex).match(/-(\d+)$/)?.[1]);
    const bright = Number(brightTextColorClass(hex).match(/-(\d+)$/)?.[1]);
    expect(bright).toBeLessThanOrEqual(base);
  });
});
