/**
 * The schema is what stands between a posted payload and the database, so what
 * is pinned here is normalization — trimming before measuring, and a blank
 * description becoming NULL rather than an empty string — alongside the bounds
 * that stop an unbounded write into a Postgres `text` column.
 */
import { describe, expect, it } from 'vitest';

import {
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
  createCollectionSchema,
} from './collections';

/** The parsed output, or a thrown assertion — keeps each test to one subject. */
function parse(input: unknown) {
  const result = createCollectionSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`expected a parse, got: ${JSON.stringify(result.error.issues)}`);
  }

  return result.data;
}

function errorsFor(input: unknown) {
  const result = createCollectionSchema.safeParse(input);

  expect(result.success).toBe(false);

  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe('createCollectionSchema', () => {
  it('trims the name before storing it', () => {
    expect(parse({ name: '  React Patterns  ' }).name).toBe('React Patterns');
  });

  it('rejects a name that is only whitespace', () => {
    // Trimmed before it is measured — chained the other way "   " would pass a
    // min(1) and a blank collection name would reach the database.
    expect(errorsFor({ name: '   ' }).name).toBe('Name is required');
  });

  it('rejects a missing name', () => {
    expect(createCollectionSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a name at exactly the ceiling', () => {
    const name = 'a'.repeat(COLLECTION_NAME_MAX_LENGTH);

    expect(parse({ name }).name).toBe(name);
  });

  it('rejects a name one character past the ceiling', () => {
    const name = 'a'.repeat(COLLECTION_NAME_MAX_LENGTH + 1);

    expect(errorsFor({ name }).name).toBe(
      `Name must be at most ${COLLECTION_NAME_MAX_LENGTH} characters`,
    );
  });

  it('measures the name after trimming, so padding cannot push it over', () => {
    const name = `  ${'a'.repeat(COLLECTION_NAME_MAX_LENGTH)}  `;

    expect(parse({ name }).name).toHaveLength(COLLECTION_NAME_MAX_LENGTH);
  });

  it('turns a blank description into null rather than an empty string', () => {
    // Every consumer renders `null` as absent; an empty string would render as
    // a present-but-empty description.
    expect(parse({ name: 'Docs', description: '   ' }).description).toBeNull();
  });

  it('trims the description', () => {
    expect(parse({ name: 'Docs', description: '  notes  ' }).description).toBe('notes');
  });

  it('leaves an omitted description undefined', () => {
    expect(parse({ name: 'Docs' }).description).toBeUndefined();
  });

  it('rejects a description past the ceiling', () => {
    const description = 'a'.repeat(COLLECTION_DESCRIPTION_MAX_LENGTH + 1);

    expect(errorsFor({ name: 'Docs', description }).description).toBe(
      `Description must be at most ${COLLECTION_DESCRIPTION_MAX_LENGTH} characters`,
    );
  });

  it('does not accept a color, which nothing reads', () => {
    const parsed = parse({ name: 'Docs', color: '#ff0000' }) as Record<string, unknown>;

    expect(parsed.color).toBeUndefined();
  });

  it('does not accept a userId from the payload', () => {
    // The owner comes from the session. Even if a caller sends one, it must not
    // survive into what the query function is handed.
    const parsed = parse({ name: 'Docs', userId: 'user_2' }) as Record<string, unknown>;

    expect(parsed.userId).toBeUndefined();
  });
});
