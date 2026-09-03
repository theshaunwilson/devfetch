/**
 * The schema is the source of truth for a save: the edit form guards the title
 * for the sake of the button, but the server action parses with this and
 * nothing else. What is pinned here is the normalization the database then
 * sees — trimmed text, blanks stored as NULL, and an absent field left alone.
 */
import { describe, expect, it } from 'vitest';

import {
  createItemSchema,
  TAGS_MAX_COUNT,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  updateItemSchema,
} from './items';

/** The messages a failed parse produced, keyed on the field they belong to. */
function errorsFor(input: unknown): Record<string, string[]> {
  const result = updateItemSchema.safeParse(input);

  if (result.success) return {};

  return result.error.issues.reduce<Record<string, string[]>>((errors, issue) => {
    const field = String(issue.path[0] ?? 'form');

    (errors[field] ??= []).push(issue.message);

    return errors;
  }, {});
}

describe('title', () => {
  it('trims before it measures, so padding cannot stand in for a title', () => {
    expect(errorsFor({ title: '   ' }).title).toEqual(['Title is required']);
  });

  it('stores the trimmed value', () => {
    const result = updateItemSchema.parse({ title: '  useDebounce  ' });

    expect(result.title).toBe('useDebounce');
  });

  it('is required — an item cannot be saved without one', () => {
    expect(errorsFor({}).title).toBeDefined();
  });

  it('is capped, since Postgres text has no length of its own', () => {
    expect(errorsFor({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1) }).title).toBeDefined();
    expect(updateItemSchema.safeParse({ title: 'a'.repeat(TITLE_MAX_LENGTH) }).success).toBe(true);
  });
});

describe('optional text fields', () => {
  it('turns a blank field into null, so clearing one empties the column', () => {
    const result = updateItemSchema.parse({
      title: 'x',
      description: '   ',
      content: '',
      language: '',
    });

    expect(result).toMatchObject({ description: null, content: null, language: null });
  });

  it('leaves an omitted field undefined, which is what keeps it untouched', () => {
    const result = updateItemSchema.parse({ title: 'x' });

    // Not null: null would clear the column for a field the form never showed.
    expect(result.content).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.url).toBeUndefined();
  });

  it('accepts an explicit null', () => {
    expect(updateItemSchema.parse({ title: 'x', description: null }).description).toBeNull();
  });

  it('trims what it keeps', () => {
    expect(updateItemSchema.parse({ title: 'x', language: '  ts  ' }).language).toBe('ts');
  });
});

describe('url', () => {
  it('rejects text that is not a URL', () => {
    expect(errorsFor({ title: 'x', url: 'not a url' }).url).toEqual(['Enter a valid URL']);
  });

  it('accepts and trims a real one', () => {
    expect(updateItemSchema.parse({ title: 'x', url: '  https://example.com/a  ' }).url).toBe(
      'https://example.com/a',
    );
  });

  it('treats a cleared field as null rather than asking it to look like a URL', () => {
    // Otherwise emptying the field would be impossible: it would fail the URL
    // check on the way out.
    expect(updateItemSchema.parse({ title: 'x', url: '' }).url).toBeNull();
  });
});

describe('tags', () => {
  it('trims each name and drops the blanks a trailing comma leaves', () => {
    expect(updateItemSchema.parse({ title: 'x', tags: [' react ', '', '  '] }).tags).toEqual([
      'react',
    ]);
  });

  it('deduplicates, because [itemId, tagId] would collide on the second write', () => {
    expect(updateItemSchema.parse({ title: 'x', tags: ['react', 'react'] }).tags).toEqual(['react']);
  });

  it('keeps names differing only in case, matching Tag being unique on the exact name', () => {
    expect(updateItemSchema.parse({ title: 'x', tags: ['React', 'react'] }).tags).toEqual([
      'React',
      'react',
    ]);
  });

  it('counts the limit after deduplication', () => {
    const repeated = Array.from({ length: TAGS_MAX_COUNT + 5 }, () => 'react');

    expect(updateItemSchema.safeParse({ title: 'x', tags: repeated }).success).toBe(true);
  });

  it('refuses more distinct tags than the limit', () => {
    const many = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, index) => `tag-${index}`);

    expect(errorsFor({ title: 'x', tags: many }).tags).toBeDefined();
  });

  it('caps a single tag name', () => {
    expect(errorsFor({ title: 'x', tags: ['a'.repeat(TAG_MAX_LENGTH + 1)] }).tags).toBeDefined();
  });

  it('accepts an empty array, which is how every tag is removed', () => {
    expect(updateItemSchema.parse({ title: 'x', tags: [] }).tags).toEqual([]);
  });
});

describe('createItemSchema', () => {
  it('demands a type, which an existing item already has and so update does not', () => {
    const result = createItemSchema.safeParse({ title: 'A note' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty type id rather than letting it reach the lookup', () => {
    const result = createItemSchema.safeParse({ typeId: '', title: 'A note' });

    expect(result.success).toBe(false);
  });

  it('normalizes the shared fields exactly as updateItemSchema does', () => {
    const result = createItemSchema.parse({
      typeId: 'type_1',
      title: '  A note  ',
      description: '   ',
      tags: ['react', 'react', ' '],
    });

    expect(result).toMatchObject({ title: 'A note', description: null, tags: ['react'] });
  });

  it('leaves the URL optional \u2014 the required-when-link rule is the action\u2019s', () => {
    // The schema cannot see the slug, only the id, so it cannot decide this.
    expect(createItemSchema.safeParse({ typeId: 'type_1', title: 'A link' }).success).toBe(true);
  });
});
