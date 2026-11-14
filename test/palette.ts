/**
 * Reads the palette out of `src/app/globals.css` for tests.
 *
 * Monaco's theme, the favicon and the email templates cannot read CSS
 * variables, so they hold copies of tokens. Tests compare those copies against
 * the stylesheet through this module, and check contrast on the real values,
 * so a palette change that misses one of them fails rather than drifting.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');

function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in globals.css`);
  return CSS.slice(start, CSS.indexOf('\n}', start));
}

function declarations(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of block(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const ROOT = declarations(':root');
const DARK = declarations('.dark');

export type Theme = 'light' | 'dark';

/** A token's value in a theme, following `var()` references to a literal. */
export function token(theme: Theme, name: string): string {
  const own = theme === 'dark' ? DARK[name] ?? ROOT[name] : ROOT[name];
  if (own === undefined) throw new Error(`--${name.replace(/^--/, '')} is not defined for ${theme}`);
  const ref = own.match(/^var\((--[\w-]+)\)$/);
  return ref ? token(theme, ref[1]) : own;
}

/** The `@theme inline` block, which is what turns a token into a utility. */
export const THEME_INLINE = block('@theme inline');

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two opaque hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` at `alpha` over an opaque `bottom`, as the browser composites it. */
export function over(top: string, alpha: number, bottom: string): string {
  const t = channels(top);
  const b = channels(bottom);
  return `#${t
    .map((c, i) => Math.round((c * alpha + b[i] * (1 - alpha)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
