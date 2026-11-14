import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { THEME_INLINE, contrast, over, token, type Theme } from '../../test/palette';
import { ITEM_TYPE_ACCENTS } from './colors';
import { SHARE_IMAGE_COLORS } from './share-image-colors';

const THEMES: Theme[] = ['light', 'dark'];
const TYPES = Object.keys(ITEM_TYPE_ACCENTS);
const AA = 4.5;
/** WCAG's floor for icons and other non-text marks. */
const NON_TEXT = 3;

describe('the token set', () => {
  // A token defined for one theme only would make its utility resolve to
  // nothing in the other, which renders as no colour at all rather than an error.
  const names = [
    ...TYPES.map((slug) => `--type-${slug}`),
    '--brand-alt',
    '--pro',
    '--success',
    '--favorite',
    '--link',
    '--syntax-keyword',
    '--syntax-function',
    '--syntax-number',
    '--window-close',
    '--window-minimize',
    '--window-maximize',
  ];

  it.each(names)('defines %s in both themes and exposes it as a utility', (name) => {
    for (const theme of THEMES) expect(token(theme, name)).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_INLINE).toContain(`--color-${name.slice(2)}: var(${name});`);
  });
});

describe.each(THEMES)('%s theme contrast', (theme) => {
  const t = (name: string) => token(theme, name);

  it('keeps body and secondary text at AA on every surface', () => {
    for (const surface of ['--background', '--card', '--muted']) {
      expect(contrast(t('--foreground'), t(surface))).toBeGreaterThanOrEqual(AA);
      expect(contrast(t('--muted-foreground'), t(surface))).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps a primary button label at AA', () => {
    expect(contrast(t('--primary-foreground'), t('--primary'))).toBeGreaterThanOrEqual(AA);
  });

  it('keeps links and the second accent readable as text', () => {
    expect(contrast(t('--link'), t('--background'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(t('--brand-alt'), t('--card'))).toBeGreaterThanOrEqual(AA);
  });

  // Badges draw an accent as small text on a tint of itself, which is the
  // hardest place for it: the background moves toward the text colour.
  it.each(TYPES)('keeps the %s type at AA as text on its own 10% tint', (slug) => {
    const colour = t(`--type-${slug}`);
    expect(contrast(colour, over(colour, 0.1, t('--card')))).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the Pro badge at AA as text on its own 15% tint', () => {
    const pro = t('--pro');
    expect(contrast(pro, over(pro, 0.15, t('--card')))).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the favourite star visible as a mark', () => {
    expect(contrast(t('--favorite'), t('--card'))).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe('the favicon', () => {
  const svg = readFileSync(fileURLToPath(new URL('../app/icon.svg', import.meta.url)), 'utf8');
  const stops = [...svg.matchAll(/stop-color="(#[0-9a-f]{6})"/gi)].map(([, hex]) => hex.toLowerCase());

  // The tab icon is the brand mark, which draws its gradient from these two
  // tokens. An SVG file cannot read them, so it holds copies.
  it('copies the brand mark gradient from the dark theme', () => {
    expect(stops).toEqual([token('dark', '--primary'), token('dark', '--brand-alt')]);
  });
});

describe('the share image', () => {
  // next/og cannot read CSS variables, so the card holds copies of the dark
  // tokens. A palette change that missed them would share the old colours.
  it('copies the dark-theme tokens exactly', () => {
    const { types, ...surfaces } = SHARE_IMAGE_COLORS;
    expect(surfaces).toEqual({
      background: token('dark', '--background'),
      card: token('dark', '--card'),
      border: token('dark', '--border'),
      foreground: token('dark', '--foreground'),
      muted: token('dark', '--muted-foreground'),
      primary: token('dark', '--primary'),
      brandAlt: token('dark', '--brand-alt'),
    });
    for (const slug of TYPES) {
      expect(types[slug as keyof typeof types]).toBe(token('dark', `--type-${slug}`));
    }
  });
});
