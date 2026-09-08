import { z } from 'zod';

import { MAX_UPLOAD_SIZE } from '@/lib/uploads';

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
/** Ours to mint, so this is a sanity bound rather than a real constraint. */
export const FILE_KEY_MAX_LENGTH = 512;
/** Most filesystems stop at 255 bytes, so a longer name did not come from one. */
export const FILE_NAME_MAX_LENGTH = 255;

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
    //
    // Constrained to http(s): a bare `z.url()` validates with `new URL()` and
    // accepts any scheme, so `javascript:` and `data:` would be stored and
    // then rendered as an href by the drawer. React and the browser both
    // defuse those today, which is the only reason this was never exploitable
    // — the rule belongs on the server rather than borrowed from them.
    // The hostname is deliberately left open: `http://localhost:3000/docs` is
    // a plausible thing to save in a developer's knowledge hub.
    .pipe(
      z
        .url({ error: 'Enter a valid URL starting with http:// or https://', protocol: /^https?$/ })
        .nullable()
    )
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

/**
 * A new item. The editable half plus the type it belongs to, which an existing
 * item already has and so `updateItemSchema` never carries.
 *
 * The one rule this schema cannot express is the type-specific one — a link
 * item must have a URL — because that depends on the type's slug, and the slug
 * is not in the payload. Only the id is, and it is worth nothing until it has
 * been resolved against the types this user can actually see. So the action
 * looks the type up first and applies `requiredFieldsFor` to what comes back,
 * rather than trusting a slug the caller sent alongside the id.
 */
export const createItemSchema = updateItemSchema.extend({
  typeId: z.string().min(1, 'Choose an item type'),

  // The three come back together from `POST /api/uploads` and are only
  // meaningful together, but they are validated as ordinary optional fields:
  // whether this type needs a file at all depends on its slug, which the
  // action resolves before it asks. `fileUrl` holds the object's key rather
  // than a URL — see `ItemDetail` — and the action checks that the key names
  // an object this user uploaded, which no shape check could tell.
  fileUrl: optionalText(FILE_KEY_MAX_LENGTH, 'File'),
  fileName: optionalText(FILE_NAME_MAX_LENGTH, 'File name'),
  fileSize: z
    .int('File size must be a whole number of bytes')
    .positive('That file is empty')
    .max(MAX_UPLOAD_SIZE, 'That file is too large')
    .nullable()
    .optional(),
});

/** What a caller sends. */
export type CreateItemInput = z.input<typeof createItemSchema>;

/** What the server action hands the query function, after normalization. */
export type CreateItemData = z.output<typeof createItemSchema>;
