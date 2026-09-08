import { describe, expect, it } from 'vitest';

import {
  copyableFieldFor,
  editableFieldsFor,
  formatTagInput,
  initialTypeId,
  parseTagInput,
  requiredFieldsFor,
  usesCodeEditor,
  usesMarkdownEditor,
} from './items';

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

describe('requiredFieldsFor', () => {
  it('requires a URL from a link, which is nothing without one', () => {
    expect(requiredFieldsFor('link')).toEqual({ url: true, file: false });
  });

  it.each(['snippet', 'prompt', 'command', 'note'])('requires no URL from a %s', (slug) => {
    expect(requiredFieldsFor(slug)).toEqual({ url: false, file: false });
  });

  it('requires nothing type-specific of a custom type', () => {
    expect(requiredFieldsFor('recipe')).toEqual({ url: false, file: false });
  });

  it('requires a file from the two types whose content is one', () => {
    // Read off `usesFileUpload` rather than a list of its own, so a file item
    // with no file cannot be created however the form is bypassed.
    expect(requiredFieldsFor('file')).toEqual({ url: false, file: true });
    expect(requiredFieldsFor('image')).toEqual({ url: false, file: true });
  });

  it('never requires a field the type does not show', () => {
    // The two are read off one set on purpose. A type that required a field it
    // never renders could not be saved at all.
    for (const slug of ['snippet', 'prompt', 'command', 'note', 'link', 'recipe']) {
      const required = requiredFieldsFor(slug);
      const editable = editableFieldsFor(slug);

      expect(required.url && !editable.url).toBe(false);
    }
  });
});

describe('usesCodeEditor', () => {
  it('is true for exactly the code types', () => {
    expect(usesCodeEditor('snippet')).toBe(true);
    expect(usesCodeEditor('command')).toBe(true);
  });

  it('is false for prose and for the types with no content at all', () => {
    expect(usesCodeEditor('note')).toBe(false);
    expect(usesCodeEditor('prompt')).toBe(false);
    expect(usesCodeEditor('link')).toBe(false);
    expect(usesCodeEditor('file')).toBe(false);
    expect(usesCodeEditor('image')).toBe(false);
  });

  it('is false for a custom type, which gets the plain textarea', () => {
    expect(usesCodeEditor('recipe')).toBe(false);
    expect(usesCodeEditor('')).toBe(false);
  });

  // The pairing that stops the two lists drifting: a type gets the code editor
  // precisely when it has a language field to drive the highlighting.
  it('agrees with the language field on every type', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt', 'link', 'recipe']) {
      expect(usesCodeEditor(slug)).toBe(editableFieldsFor(slug).language);
    }
  });

  // A type with no content field has nothing to put in an editor.
  it('never claims a type that has no content field', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt', 'link', 'recipe']) {
      if (usesCodeEditor(slug)) expect(editableFieldsFor(slug).content).toBe(true);
    }
  });
});

describe('initialTypeId', () => {
  const TYPES = [
    { id: 'type_snippet', slug: 'snippet' },
    { id: 'type_prompt', slug: 'prompt' },
    { id: 'type_link', slug: 'link' },
  ];

  it('opens on the requested type', () => {
    expect(initialTypeId(TYPES, 'link')).toBe('type_link');
    expect(initialTypeId(TYPES, 'prompt')).toBe('type_prompt');
  });

  // The case that makes this worth a function: the items page passes its own
  // slug, and /items/file names a Pro type the dialog does not offer.
  it('falls back to the first type when the slug is not on offer', () => {
    expect(initialTypeId(TYPES, 'file')).toBe('type_snippet');
    expect(initialTypeId(TYPES, 'image')).toBe('type_snippet');
  });

  it('falls back when no slug is given at all, as the top bar does', () => {
    expect(initialTypeId(TYPES)).toBe('type_snippet');
    expect(initialTypeId(TYPES, undefined)).toBe('type_snippet');
  });

  it('falls back rather than matching loosely on case or padding', () => {
    // The slug arrives from the URL and is compared to stored slugs; neither
    // is normalized here, so a near-miss must not resolve.
    expect(initialTypeId(TYPES, 'Link')).toBe('type_snippet');
    expect(initialTypeId(TYPES, ' link ')).toBe('type_snippet');
  });

  it('always returns an id that is actually on offer', () => {
    for (const slug of ['snippet', 'link', 'file', '', undefined, 'nonsense']) {
      expect(TYPES.map((type) => type.id)).toContain(initialTypeId(TYPES, slug));
    }
  });

  // A custom type may reuse a system slug, and the list is ordered so the
  // user's own comes first; the first match is therefore the right one.
  it('takes the first match when two types share a slug', () => {
    const shadowed = [{ id: 'custom_snippet', slug: 'snippet' }, ...TYPES];

    expect(initialTypeId(shadowed, 'snippet')).toBe('custom_snippet');
  });
});

describe('usesMarkdownEditor', () => {
  it('is true for exactly the prose types', () => {
    expect(usesMarkdownEditor('note')).toBe(true);
    expect(usesMarkdownEditor('prompt')).toBe(true);
  });

  it('is false for the code types, which keep Monaco', () => {
    expect(usesMarkdownEditor('snippet')).toBe(false);
    expect(usesMarkdownEditor('command')).toBe(false);
  });

  it('is false for the types with no content at all', () => {
    expect(usesMarkdownEditor('link')).toBe(false);
    expect(usesMarkdownEditor('file')).toBe(false);
    expect(usesMarkdownEditor('image')).toBe(false);
  });

  it('is false for a custom type, which gets the plain textarea', () => {
    expect(usesMarkdownEditor('recipe')).toBe(false);
    expect(usesMarkdownEditor('')).toBe(false);
  });

  // The property the derivation exists to guarantee: the two editors partition
  // the content types rather than overlapping, so no type can end up rendering
  // both editors at once or falling through to the textarea by accident.
  it('never overlaps with the code editor', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt', 'link', 'file', 'image', 'recipe']) {
      expect(usesCodeEditor(slug) && usesMarkdownEditor(slug)).toBe(false);
    }
  });

  it('covers every content type between the two editors', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt']) {
      expect(usesCodeEditor(slug) || usesMarkdownEditor(slug)).toBe(true);
    }
  });

  // A type with no content field has nothing for either editor to render.
  it('offers no editor to a type that has no content field', () => {
    for (const slug of ['link', 'file', 'image', 'recipe']) {
      expect(editableFieldsFor(slug).content).toBe(false);
      expect(usesCodeEditor(slug) || usesMarkdownEditor(slug)).toBe(false);
    }
  });
});

describe('copyableFieldFor', () => {
  it('copies the content of every type that has content', () => {
    expect(copyableFieldFor('snippet')).toBe('content');
    expect(copyableFieldFor('command')).toBe('content');
    expect(copyableFieldFor('prompt')).toBe('content');
    expect(copyableFieldFor('note')).toBe('content');
  });

  it('copies a link\'s URL, which is the only body it has', () => {
    expect(copyableFieldFor('link')).toBe('url');
  });

  it('offers nothing for the upload types or a custom one', () => {
    // A file or image item holds an object, not text; a custom type holds
    // neither, so a card for any of them gets no button at all.
    expect(copyableFieldFor('file')).toBeNull();
    expect(copyableFieldFor('image')).toBeNull();
    expect(copyableFieldFor('recipe')).toBeNull();
    expect(copyableFieldFor('')).toBeNull();
  });

  // The property the derivation exists to guarantee: a button is offered
  // exactly when the item type has that field, so a card can never offer to
  // copy a column its items never fill.
  it('names a field only when that type actually has it', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt', 'link', 'file', 'image', 'recipe']) {
      const field = copyableFieldFor(slug);

      if (field === null) {
        expect(editableFieldsFor(slug)).toMatchObject({ content: false, url: false });
      } else {
        expect(editableFieldsFor(slug)[field]).toBe(true);
      }
    }
  });

  it('offers a button to every type that has a body', () => {
    for (const slug of ['snippet', 'command', 'note', 'prompt', 'link']) {
      expect(copyableFieldFor(slug)).not.toBeNull();
    }
  });
});
