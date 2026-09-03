import { describe, expect, it } from 'vitest';

import { editableFieldsFor, formatTagInput, parseTagInput } from './items';

describe('editableFieldsFor', () => {
  it('gives snippet and command a language, and the other content types none', () => {
    expect(editableFieldsFor('snippet')).toEqual({ content: true, language: true, url: false });
    expect(editableFieldsFor('command')).toEqual({ content: true, language: true, url: false });
    expect(editableFieldsFor('prompt')).toEqual({ content: true, language: false, url: false });
    expect(editableFieldsFor('note')).toEqual({ content: true, language: false, url: false });
  });

  it('gives link a URL and no content', () => {
    expect(editableFieldsFor('link')).toEqual({ content: false, language: false, url: true });
  });

  it('gives the upload types none of the three', () => {
    // File and Image hold an upload, not typed-in content.
    expect(editableFieldsFor('file')).toEqual({ content: false, language: false, url: false });
    expect(editableFieldsFor('image')).toEqual({ content: false, language: false, url: false });
  });

  it('falls back to the shared fields for a custom type', () => {
    // A Pro user's own type matches no slug here, so it edits title,
    // description and tags only rather than crashing or guessing.
    expect(editableFieldsFor('recipe')).toEqual({ content: false, language: false, url: false });
  });

  it('matches the slug exactly, so a lookalike gets no fields', () => {
    expect(editableFieldsFor('Snippet').content).toBe(false);
    expect(editableFieldsFor('snippets').content).toBe(false);
  });
});

describe('parseTagInput', () => {
  it('splits on commas and trims each name', () => {
    expect(parseTagInput('react, hooks ,  typescript')).toEqual(['react', 'hooks', 'typescript']);
  });

  it('drops blank entries, so a trailing comma is not an error', () => {
    expect(parseTagInput('react, ,hooks,')).toEqual(['react', 'hooks']);
  });

  it('returns nothing for an empty or whitespace-only input', () => {
    expect(parseTagInput('')).toEqual([]);
    expect(parseTagInput('   ')).toEqual([]);
    expect(parseTagInput(',,,')).toEqual([]);
  });

  it('deduplicates, since the join rows are keyed on [itemId, tagId]', () => {
    expect(parseTagInput('react, react , react')).toEqual(['react']);
  });

  it('keeps names that differ only in case, because Tag is unique on the exact name', () => {
    expect(parseTagInput('React, react')).toEqual(['React', 'react']);
  });
});

describe('formatTagInput', () => {
  it('round-trips through parseTagInput', () => {
    const tags = ['react', 'hooks'];

    expect(parseTagInput(formatTagInput(tags))).toEqual(tags);
  });

  it('is empty for an item with no tags', () => {
    expect(formatTagInput([])).toBe('');
  });
});
