import { z } from 'zod';

import {
  CONTENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  FILE_NAME_MAX_LENGTH,
  LANGUAGE_MAX_LENGTH,
  TAG_MAX_LENGTH,
  TAGS_MAX_COUNT,
  TITLE_MAX_LENGTH,
  URL_MAX_LENGTH,
} from '@/lib/validation/items';
import { optionalText, trimmed } from '@/lib/validation/text';

/**
 * What the tag suggester is sent: the item's text as it currently stands in
 * the form, which may not be saved yet — the create dialog has no item at all.
 *
 * Reuses the item ceilings rather than inventing its own, so nothing the forms
 * could not save can be sent here either. The title may be blank, but not
 * everything may be: there has to be something to tag.
 */
export const generateAutoTagsSchema = z
  .object({
    title: trimmed().pipe(
      z.string().max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
    ),
    description: optionalText(DESCRIPTION_MAX_LENGTH, 'Description'),
    content: optionalText(CONTENT_MAX_LENGTH, 'Content'),
    url: optionalText(URL_MAX_LENGTH, 'URL'),
    currentTags: z.array(z.string().max(TAG_MAX_LENGTH)).max(TAGS_MAX_COUNT),
  })
  .refine((value) => Boolean(value.title || value.description || value.content || value.url), {
    message: 'Add a title or some content first.',
  });

export type GenerateAutoTagsInput = z.input<typeof generateAutoTagsSchema>;

/** An item type's name is ours to mint, so this is a sanity bound. */
export const SUMMARY_TYPE_NAME_MAX_LENGTH = 50;

/**
 * What the description writer is sent: the item as it currently stands in the
 * form, for any type. Which fields arrive depends on the type — content for
 * text items, a URL for links, a file name for uploads — so all of them are
 * optional, and the only rule is that there is something to describe.
 *
 * The current description is not accepted at all: it is what is being
 * written, not something to write it from.
 */
export const generateSummarySchema = z
  .object({
    title: trimmed().pipe(
      z.string().max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
    ),
    typeName: trimmed().pipe(
      z.string().min(1, 'Pick a type first.').max(SUMMARY_TYPE_NAME_MAX_LENGTH),
    ),
    content: optionalText(CONTENT_MAX_LENGTH, 'Content'),
    language: optionalText(LANGUAGE_MAX_LENGTH, 'Language'),
    url: optionalText(URL_MAX_LENGTH, 'URL'),
    fileName: optionalText(FILE_NAME_MAX_LENGTH, 'File name'),
    tags: z.array(z.string().max(TAG_MAX_LENGTH)).max(TAGS_MAX_COUNT),
  })
  .refine((value) => Boolean(value.title || value.content || value.url || value.fileName), {
    message: 'Add a title or some content first.',
  });

export type GenerateSummaryInput = z.input<typeof generateSummarySchema>;
