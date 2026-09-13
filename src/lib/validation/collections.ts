import { z } from 'zod';

import { optionalText, requiredText } from '@/lib/validation/text';

/**
 * Ceilings on the free-text fields. Postgres `text` has no length of its own,
 * so without these a single request could write an unbounded amount.
 *
 * Declared here rather than borrowed from `validation/items.ts`: a collection
 * name and an item title being the same length is a coincidence, not a shared
 * rule, and either could move without the other.
 */
export const COLLECTION_NAME_MAX_LENGTH = 200;
export const COLLECTION_DESCRIPTION_MAX_LENGTH = 1000;

/**
 * A new collection. The owner is not among these fields — it comes from the
 * session, never from the payload.
 *
 * `Collection.color` is deliberately absent: nothing writes it and nothing
 * reads it, since the dashboard and sidebar take their accent from the
 * collection's most-used item *type* rather than from that column.
 */
export const createCollectionSchema = z.object({
  name: requiredText(COLLECTION_NAME_MAX_LENGTH, 'Name'),
  description: optionalText(COLLECTION_DESCRIPTION_MAX_LENGTH, 'Description'),
});

/** What a caller sends. Output differs — the schema trims and nulls blanks. */
export type CreateCollectionInput = z.input<typeof createCollectionSchema>;

/** What the server action hands the query function, after normalization. */
export type CreateCollectionData = z.output<typeof createCollectionSchema>;

/**
 * Editing a collection's metadata.
 *
 * Deliberately an alias rather than a second copy: a collection is created and
 * edited through the same two fields, so the rules are the same rules, and two
 * declarations of them could only drift. The name exists so the call sites read
 * as what they do, and so a future divergence has somewhere to happen.
 *
 * The id is not a field here, the way `updateItemSchema` does not carry one —
 * it is a separate argument to the action, since it addresses the row rather
 * than being part of what is written to it.
 */
export const updateCollectionSchema = createCollectionSchema;

/** What a caller sends. Output differs — the schema trims and nulls blanks. */
export type UpdateCollectionInput = z.input<typeof updateCollectionSchema>;

/** What the server action hands the query function, after normalization. */
export type UpdateCollectionData = z.output<typeof updateCollectionSchema>;
