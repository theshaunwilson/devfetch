/**
 * The failure shapes the item and collection actions share. Pure, so nothing
 * is mocked — the schemas are real.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CHECK_FIELDS, fieldError, invalidFields } from './action-messages';

describe('fieldError', () => {
  it('puts one message on one field under the shared banner', () => {
    expect(fieldError('url', 'URL is required')).toEqual({
      success: false,
      error: CHECK_FIELDS,
      fieldErrors: { url: ['URL is required'] },
    });
  });
});

describe('invalidFields', () => {
  const schema = z.object({
    title: z.string().min(1, 'Title is required'),
    tags: z.array(z.string().max(3, 'Tag too long')),
  });

  it('reports every failing field under the shared banner', () => {
    const parsed = schema.safeParse({ title: '', tags: [] });

    expect(parsed.success).toBe(false);
    expect(invalidFields(parsed.error!)).toEqual({
      success: false,
      error: CHECK_FIELDS,
      fieldErrors: { title: ['Title is required'] },
    });
  });

  it('groups a nested path on its first segment, so it lands on the field the form renders', () => {
    const parsed = schema.safeParse({ title: 'ok', tags: ['fine', 'toolong'] });

    expect(invalidFields(parsed.error!).fieldErrors).toEqual({
      tags: ['Tag too long', 'Tag too long'],
    });
  });
});
