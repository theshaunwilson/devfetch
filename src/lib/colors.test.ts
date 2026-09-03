import { describe, expect, it } from 'vitest';

import { borderColorClass, softBgColorClass, textColorClass } from './colors';

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

describe('the three maps', () => {
  // A type whose colour resolves in one map and falls back in another would
  // render a tinted icon inside a default-bordered card.
  const SEEDED_HEXES = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#fde047', '#6b7280'];

  it.each(SEEDED_HEXES)('resolves %s in all three, never a fallback', (hex) => {
    expect(textColorClass(hex)).not.toBe('text-muted-foreground');
    expect(borderColorClass(hex)).not.toBe('border-l-border');
    expect(softBgColorClass(hex)).not.toBe('bg-muted');
  });
});
