import { z } from 'zod';

/**
 * Ceilings on the free-text fields. Postgres `text` has no length of its own,
 * so without these a single request could write an unbounded amount.
 */
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const CONTENT_MAX_LENGTH = 100_000;
export const LANGUAGE_MAX_LENGTH = 50;
export const URL_MAX_LENGTH = 2048;
export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX_COUNT = 20;

/**
 * Trims first, then checks — chained the other way a value would be measured
 * with its padding still on, and `"   "` would pass a `min(1)`. Zod runs checks
 * before transforms within one schema, so the order has to be forced with a
 * pipe rather than a chain.
 */
function trimmed() {
  return z.string().transform((value) => value.trim());
}

/**
 * An optional free-text field. Blank means "cleared", so it is stored as NULL
 * rather than an empty string — the schema treats both the same way, and every
 * consumer already renders `null` as absent.
 *
 * Omitted entirely is different from blank: the field is then left untouched,
 * which is how a type-specific input that was never shown avoids wiping the
 * column behind it.
 */
function optionalText(max: number, label: string) {
  return trimmed()
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`))
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

/**
 * The editable half of an item. Everything but the title is optional, so a
 * caller sends only the fields its item type actually shows.
 */
export const updateItemSchema = z.object({
  title: trimmed().pipe(
    z
      .string()
      .min(1, 'Title is required')
      .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
  ),

  description: optionalText(DESCRIPTION_MAX_LENGTH, 'Description'),
  content: optionalText(CONTENT_MAX_LENGTH, 'Content'),
  language: optionalText(LANGUAGE_MAX_LENGTH, 'Language'),

  url: trimmed()
    .pipe(z.string().max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`))
    .transform((value) => (value === '' ? null : value))
    // Nullable on the inner schema too, so a cleared field passes through
    // instead of being asked to look like a URL.
    .pipe(z.url('Enter a valid URL').nullable())
    .nullable()
    .optional(),

  tags: z
    .array(z.string())
    .transform((values) => {
      // Deduplicated before it reaches the database: the tag join rows are
      // keyed on [itemId, tagId], so the same name twice would collide.
      // Compared exactly, because Tag is unique on [userId, name] — "React"
      // and "react" really are two different tags.
      const seen = new Set<string>();

      return values.reduce<string[]>((names, value) => {
        const name = value.trim();

        // A blank entry is what a trailing comma produces, so it is dropped
        // rather than reported as an error.
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }

        return names;
      }, []);
    })
    .pipe(
      z
        .array(z.string().max(TAG_MAX_LENGTH, `A tag must be at most ${TAG_MAX_LENGTH} characters`))
        // Counted after deduplication, so the same name typed twice does not
        // spend two of the twenty.
        .max(TAGS_MAX_COUNT, `An item can have at most ${TAGS_MAX_COUNT} tags`),
    )
    .optional(),
});

/** What a caller sends. Output differs — the schema trims and nulls blanks. */
export type UpdateItemInput = z.input<typeof updateItemSchema>;

/** What the server action hands the query function, after normalization. */
export type UpdateItemData = z.output<typeof updateItemSchema>;
