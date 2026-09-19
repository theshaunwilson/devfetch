/**
 * Item types and collections carry a hex color in the data model.
 * Styling uses Tailwind classes only, so hex values are mapped here
 * instead of being applied as inline styles.
 */
const TEXT_COLORS: Record<string, string> = {
  '#3b82f6': 'text-blue-500',
  '#38bdf8': 'text-sky-400',
  '#22c55e': 'text-green-500',
  '#a855f7': 'text-purple-500',
  '#ec4899': 'text-pink-500',
  '#f97316': 'text-orange-500',
  '#eab308': 'text-yellow-500',
  '#94a3b8': 'text-slate-400',
  '#e2e8f0': 'text-slate-200',
  '#8b5cf6': 'text-violet-500',
  '#10b981': 'text-emerald-500',
  '#fde047': 'text-yellow-300',
  '#6b7280': 'text-gray-500',
};

const BORDER_COLORS: Record<string, string> = {
  '#3b82f6': 'border-l-blue-500',
  '#38bdf8': 'border-l-sky-400',
  '#22c55e': 'border-l-green-500',
  '#a855f7': 'border-l-purple-500',
  '#ec4899': 'border-l-pink-500',
  '#f97316': 'border-l-orange-500',
  '#eab308': 'border-l-yellow-500',
  '#94a3b8': 'border-l-slate-400',
  '#e2e8f0': 'border-l-slate-200',
  '#8b5cf6': 'border-l-violet-500',
  '#10b981': 'border-l-emerald-500',
  '#fde047': 'border-l-yellow-300',
  '#6b7280': 'border-l-gray-500',
};

const SOFT_BG_COLORS: Record<string, string> = {
  '#3b82f6': 'bg-blue-500/10',
  '#38bdf8': 'bg-sky-400/10',
  '#22c55e': 'bg-green-500/10',
  '#a855f7': 'bg-purple-500/10',
  '#ec4899': 'bg-pink-500/10',
  '#f97316': 'bg-orange-500/10',
  '#eab308': 'bg-yellow-500/10',
  '#94a3b8': 'bg-slate-400/10',
  '#e2e8f0': 'bg-slate-200/10',
  '#8b5cf6': 'bg-violet-500/10',
  '#10b981': 'bg-emerald-500/10',
  '#fde047': 'bg-yellow-300/10',
  '#6b7280': 'bg-gray-500/10',
};

/**
 * A brighter tier of the same accents, for small text sitting on a tinted
 * background of its own colour.
 *
 * The 500-level entries above are tuned for icons and borders, where a shape
 * carries the colour. Behind 11px text on a 10% tint of the same hue they run
 * out of contrast: measured against the homepage's tag badges, violet-500
 * lands at 4.47:1 and gray-500 at 3.77:1, both under AA's 4.5, while blue-500
 * only just clears it at 4.79. The 400 level clears it for every accent, the
 * narrowest being violet at 6.41.
 *
 * Two keys keep their base class rather than stepping to 400: `#fde047` and
 * `#e2e8f0` are already the light end of their families, so a 400 would be
 * darker than what they have.
 */
const BRIGHT_TEXT_COLORS: Record<string, string> = {
  '#3b82f6': 'text-blue-400',
  '#38bdf8': 'text-sky-300',
  '#22c55e': 'text-green-400',
  '#a855f7': 'text-purple-400',
  '#ec4899': 'text-pink-400',
  '#f97316': 'text-orange-400',
  '#eab308': 'text-yellow-400',
  '#94a3b8': 'text-slate-300',
  '#e2e8f0': 'text-slate-200',
  '#8b5cf6': 'text-violet-400',
  '#10b981': 'text-emerald-400',
  '#fde047': 'text-yellow-300',
  '#6b7280': 'text-gray-400',
};

export function textColorClass(hex: string | null | undefined): string {
  return (hex && TEXT_COLORS[hex]) || 'text-muted-foreground';
}

/**
 * Accent text bright enough to read as small type on a tint of its own colour.
 * Falls back to the same muted class `textColorClass` uses.
 */
export function brightTextColorClass(hex: string | null | undefined): string {
  return (hex && BRIGHT_TEXT_COLORS[hex]) || 'text-muted-foreground';
}

/** Left accent border used on collection and item cards. */
export function borderColorClass(hex: string | null | undefined): string {
  return (hex && BORDER_COLORS[hex]) || 'border-l-border';
}

/** Tinted background used behind item type icons. */
export function softBgColorClass(hex: string | null | undefined): string {
  return (hex && SOFT_BG_COLORS[hex]) || 'bg-muted';
}

/**
 * The seeded accent for each system item type, keyed by slug.
 *
 * The homepage represents item types without reading any of them from the
 * database, so it needs the same hexes `prisma/seed.ts` writes. Naming them
 * here — beside the maps that resolve them — means a typo is one place rather
 * than scattered through marketing copy, where it would silently fall back to
 * a muted class instead of failing.
 */
export const ITEM_TYPE_ACCENTS = {
  snippet: '#3b82f6',
  prompt: '#8b5cf6',
  command: '#f97316',
  note: '#fde047',
  file: '#6b7280',
  image: '#ec4899',
  link: '#10b981',
} as const;

export type ItemTypeSlug = keyof typeof ITEM_TYPE_ACCENTS;
