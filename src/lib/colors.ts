/**
 * Item-type colours.
 *
 * The colours themselves live in `src/app/globals.css` as `--type-*` tokens,
 * with a light and a dark value each. What the database holds in
 * `ItemType.color` is a fixed hex per built-in type, and it is used here only
 * as a key: it names which type a row is, and the token decides what that type
 * looks like. Keeping the stored values as they are means a palette change
 * needs no data migration, in development or in production.
 *
 * Each class is written out in full because Tailwind generates only the class
 * names it can find in the source; one built from a template would not exist.
 */

/**
 * The stored colour key for each system item type, keyed by slug.
 *
 * These are the values `prisma/seed.ts` writes and every environment already
 * holds. The homepage represents item types without reading the database, so
 * it uses these too.
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

const SLUG_BY_KEY: Record<string, ItemTypeSlug> = Object.fromEntries(
  Object.entries(ITEM_TYPE_ACCENTS).map(([slug, key]) => [key, slug as ItemTypeSlug])
);

const TEXT_COLORS: Record<ItemTypeSlug, string> = {
  snippet: 'text-type-snippet',
  prompt: 'text-type-prompt',
  command: 'text-type-command',
  note: 'text-type-note',
  file: 'text-type-file',
  image: 'text-type-image',
  link: 'text-type-link',
};

const BORDER_COLORS: Record<ItemTypeSlug, string> = {
  snippet: 'border-l-type-snippet',
  prompt: 'border-l-type-prompt',
  command: 'border-l-type-command',
  note: 'border-l-type-note',
  file: 'border-l-type-file',
  image: 'border-l-type-image',
  link: 'border-l-type-link',
};

const SOFT_BG_COLORS: Record<ItemTypeSlug, string> = {
  snippet: 'bg-type-snippet/10',
  prompt: 'bg-type-prompt/10',
  command: 'bg-type-command/10',
  note: 'bg-type-note/10',
  file: 'bg-type-file/10',
  image: 'bg-type-image/10',
  link: 'bg-type-link/10',
};

function slugFor(key: string | null | undefined): ItemTypeSlug | undefined {
  return key ? SLUG_BY_KEY[key] : undefined;
}

/**
 * Accent text for an item type. Every token clears AA as small text on a 10%
 * tint of its own colour in both themes, so the same class serves icons and
 * badge labels.
 */
export function textColorClass(key: string | null | undefined): string {
  const slug = slugFor(key);
  return slug ? TEXT_COLORS[slug] : 'text-muted-foreground';
}

/** Left accent border used on collection and item cards. */
export function borderColorClass(key: string | null | undefined): string {
  const slug = slugFor(key);
  return slug ? BORDER_COLORS[slug] : 'border-l-border';
}

/** Tinted background used behind item type icons. */
export function softBgColorClass(key: string | null | undefined): string {
  const slug = slugFor(key);
  return slug ? SOFT_BG_COLORS[slug] : 'bg-muted';
}
