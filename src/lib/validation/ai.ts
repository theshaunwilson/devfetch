import { z } from 'zod';

import {
  CONTENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
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
