import { describe, expect, it } from 'vitest';

import {
  appendTagInput,
  hasTagInput,
  buildCreateItemPayload,
  buildSummarySource,
  copyableFieldFor,
  editableFieldsFor,
  formatTagInput,
  groupItemsByShape,
  initialTypeId,
  parseTagInput,
  requiredFieldsFor,
  tagsForAi,
  usesCodeEditor,
  usesMarkdownEditor,
  usesPromptOptimizer,
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

  /** The full list, as the dialog now receives it — Pro types included. */
  const ALL_TYPES = [...TYPES, { id: 'type_file', slug: 'file' }];

  it('opens on the requested type', () => {
    expect(initialTypeId(TYPES, 'link', false)).toBe('type_link');
    expect(initialTypeId(TYPES, 'prompt', false)).toBe('type_prompt');
  });

  it('falls back to the first type when the slug is not on offer', () => {
    expect(initialTypeId(TYPES, 'file', false)).toBe('type_snippet');
    expect(initialTypeId(TYPES, 'image', false)).toBe('type_snippet');
  });

  // The case the plan argument exists for. `/items/file` renders a "New File"
  // button that passes `file`, and the type IS on the list now — it is simply
  // disabled for this viewer. Without the check the dialog would open on it,
  // with the submit blocked and nothing saying why.
  it('skips a Pro type a free viewer cannot create, even when it is on the list', () => {
    expect(initialTypeId(ALL_TYPES, 'file', false)).toBe('type_snippet');
  });

  it('honours that same Pro type for a viewer who can create it', () => {
    expect(initialTypeId(ALL_TYPES, 'file', true)).toBe('type_file');
  });

  it('falls back to the first type the viewer can create, not merely the first', () => {
    const proFirst = [{ id: 'type_image', slug: 'image' }, ...TYPES];

    expect(initialTypeId(proFirst, undefined, false)).toBe('type_snippet');
    expect(initialTypeId(proFirst, undefined, true)).toBe('type_image');
  });

  it('still returns a string when every offered type is out of reach', () => {
    // Not reachable from the UI, but the return type promises a string.
    const proOnly = [{ id: 'type_file', slug: 'file' }];

    expect(initialTypeId(proOnly, undefined, false)).toBe('type_file');
  });

  it('falls back when no slug is given at all, as the top bar does', () => {
    expect(initialTypeId(TYPES, undefined, false)).toBe('type_snippet');
  });

  it('falls back rather than matching loosely on case or padding', () => {
    // The slug arrives from the URL and is compared to stored slugs; neither
    // is normalized here, so a near-miss must not resolve.
    expect(initialTypeId(TYPES, 'Link', false)).toBe('type_snippet');
    expect(initialTypeId(TYPES, ' link ', false)).toBe('type_snippet');
  });

  it('always returns an id that is actually on offer', () => {
    for (const slug of ['snippet', 'link', 'file', '', undefined, 'nonsense']) {
      for (const isPro of [true, false]) {
        expect(TYPES.map((type) => type.id)).toContain(initialTypeId(TYPES, slug, isPro));
      }
    }
  });

  // A custom type may reuse a system slug, and the list is ordered so the
  // user's own comes first; the first match is therefore the right one.
  it('takes the first match when two types share a slug', () => {
    const shadowed = [{ id: 'custom_snippet', slug: 'snippet' }, ...TYPES];

    expect(initialTypeId(shadowed, 'snippet', false)).toBe('custom_snippet');
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

describe('buildCreateItemPayload', () => {
  const base = {
    typeId: 'type_1',
    slug: 'snippet',
    title: 'A snippet',
    description: 'about it',
    content: 'const x = 1;',
    language: 'typescript',
    url: 'https://example.com',
    tags: 'react, hooks',
    collectionIds: [],
    file: null,
  };

  it('always sends the collections, even when none are ticked', () => {
    // Not a type-specific field: every type can be filed, so an empty array is
    // an answer rather than a field the form never showed.
    expect(buildCreateItemPayload({ ...base, collectionIds: [] }).collectionIds).toEqual([]);
    expect(
      buildCreateItemPayload({ ...base, collectionIds: ['coll_1', 'coll_2'] }).collectionIds,
    ).toEqual(['coll_1', 'coll_2']);
  });

  it('always carries the fields every item has', () => {
    const payload = buildCreateItemPayload({ ...base, slug: 'note' });

    expect(payload.typeId).toBe('type_1');
    expect(payload.title).toBe('A snippet');
    expect(payload.description).toBe('about it');
    expect(payload.tags).toEqual(['react', 'hooks']);
  });

  it('includes only the fields this type actually renders', () => {
    const snippet = buildCreateItemPayload(base);

    expect(snippet.content).toBe('const x = 1;');
    expect(snippet.language).toBe('typescript');
    // A snippet has no URL field, so the typed value must not ride along.
    expect('url' in snippet).toBe(false);
  });

  it('omits an unrendered field entirely rather than sending it blank', () => {
    // The rule this function exists for. `updateItem` reads undefined as
    // "leave alone" and null as "clear", so a blank for a field the user never
    // saw is how a save silently wipes a column.
    const link = buildCreateItemPayload({ ...base, slug: 'link' });

    expect(link.url).toBe('https://example.com');
    expect('content' in link).toBe(false);
    expect('language' in link).toBe(false);
  });

  it('gives a prompt content but no language', () => {
    const prompt = buildCreateItemPayload({ ...base, slug: 'prompt' });

    expect(prompt.content).toBe('const x = 1;');
    expect('language' in prompt).toBe(false);
  });

  it('gives a custom type only the fields every item has', () => {
    const custom = buildCreateItemPayload({ ...base, slug: 'recipe' });

    expect('content' in custom).toBe(false);
    expect('language' in custom).toBe(false);
    expect('url' in custom).toBe(false);
  });

  it('sets the file trio together, keyed off the object key', () => {
    const file = { key: 'users/user_1/abc.pdf', fileName: 'notes.pdf', fileSize: 1024 };
    const payload = buildCreateItemPayload({ ...base, slug: 'file', file });

    // fileUrl holds the object's key, not a URL — uploads are private.
    expect(payload.fileUrl).toBe('users/user_1/abc.pdf');
    expect(payload.fileName).toBe('notes.pdf');
    expect(payload.fileSize).toBe(1024);
  });

  it('sends no file fields when the type takes one but none was chosen', () => {
    const payload = buildCreateItemPayload({ ...base, slug: 'file', file: null });

    expect('fileUrl' in payload).toBe(false);
    expect('fileName' in payload).toBe(false);
    expect('fileSize' in payload).toBe(false);
  });

  it('ignores a file on a type that takes none', () => {
    const file = { key: 'users/user_1/abc.pdf', fileName: 'notes.pdf', fileSize: 1024 };
    const payload = buildCreateItemPayload({ ...base, slug: 'snippet', file });

    expect('fileUrl' in payload).toBe(false);
  });

  it('deduplicates tags and absorbs a trailing comma', () => {
    const payload = buildCreateItemPayload({ ...base, tags: 'react, react, hooks,' });

    expect(payload.tags).toEqual(['react', 'hooks']);
  });
});

describe('groupItemsByShape', () => {
  const item = (id: string, slug: string) => ({ id, type: { slug } });

  it('puts every text-bodied type in cards', () => {
    const items = [
      item('a', 'snippet'),
      item('b', 'prompt'),
      item('c', 'command'),
      item('d', 'note'),
      item('e', 'link'),
    ];

    const grouped = groupItemsByShape(items);

    expect(grouped.cards).toEqual(items);
    expect(grouped.images).toEqual([]);
    expect(grouped.files).toEqual([]);
  });

  it('separates images and files from the cards', () => {
    const grouped = groupItemsByShape([
      item('a', 'snippet'),
      item('b', 'image'),
      item('c', 'file'),
    ]);

    expect(grouped.cards.map((i) => i.id)).toEqual(['a']);
    expect(grouped.images.map((i) => i.id)).toEqual(['b']);
    expect(grouped.files.map((i) => i.id)).toEqual(['c']);
  });

  it('keeps an image out of the file group and a file out of the image group', () => {
    const grouped = groupItemsByShape([item('img', 'image'), item('doc', 'file')]);

    expect(grouped.images.map((i) => i.id)).toEqual(['img']);
    expect(grouped.files.map((i) => i.id)).toEqual(['doc']);
  });

  it('partitions: every item lands in exactly one group', () => {
    const slugs = ['snippet', 'prompt', 'command', 'note', 'link', 'image', 'file', 'recipe'];
    const items = slugs.map((slug, i) => item(String(i), slug));

    const { cards, images, files } = groupItemsByShape(items);

    expect(cards.length + images.length + files.length).toBe(items.length);
    const ids = [...cards, ...images, ...files].map((i) => i.id).sort();
    expect(ids).toEqual(items.map((i) => i.id).sort());
  });

  it('sends a custom type to cards rather than dropping it', () => {
    const grouped = groupItemsByShape([item('x', 'recipe')]);

    expect(grouped.cards.map((i) => i.id)).toEqual(['x']);
  });

  it("preserves the caller's order within each group", () => {
    const grouped = groupItemsByShape([
      item('s1', 'snippet'),
      item('f1', 'file'),
      item('s2', 'snippet'),
      item('i1', 'image'),
      item('f2', 'file'),
      item('s3', 'snippet'),
    ]);

    expect(grouped.cards.map((i) => i.id)).toEqual(['s1', 's2', 's3']);
    expect(grouped.files.map((i) => i.id)).toEqual(['f1', 'f2']);
    expect(grouped.images.map((i) => i.id)).toEqual(['i1']);
  });

  it('returns three empty groups for no items', () => {
    expect(groupItemsByShape([])).toEqual({ cards: [], images: [], files: [] });
  });
});

describe('hasTagInput', () => {
  it('finds a tag ignoring case and padding', () => {
    expect(hasTagInput('React,  hooks ', 'react')).toBe(true);
    expect(hasTagInput('react, hooks', ' HOOKS ')).toBe(true);
  });

  it('does not match part of a tag', () => {
    expect(hasTagInput('react-hooks', 'react')).toBe(false);
  });
});

describe('appendTagInput', () => {
  it('adds a tag to the end', () => {
    expect(appendTagInput('react, hooks', 'typescript')).toBe('react, hooks, typescript');
  });

  it('adds to an empty input without a leading comma', () => {
    expect(appendTagInput('', 'react')).toBe('react');
  });

  it('tidies a trailing comma and stray spacing as it goes', () => {
    expect(appendTagInput('react,  hooks,', 'docker')).toBe('react, hooks, docker');
  });

  it('leaves the input alone when it already holds the tag, in any case', () => {
    expect(appendTagInput('React, hooks,', 'react')).toBe('React, hooks,');
  });

  it('ignores a blank tag', () => {
    expect(appendTagInput('react', '  ')).toBe('react');
  });
});

describe('tagsForAi', () => {
  it('parses the input, dropping blanks and duplicates', () => {
    expect(tagsForAi('react, , hooks, react,')).toEqual(['react', 'hooks']);
  });

  it('drops a tag the save would refuse rather than failing the request', () => {
    expect(tagsForAi(`react, ${'x'.repeat(51)}, hooks`)).toEqual(['react', 'hooks']);
  });

  it('caps the list at the save limit', () => {
    const input = Array.from({ length: 25 }, (_, i) => `tag-${i}`).join(', ');

    expect(tagsForAi(input)).toHaveLength(20);
  });
});

describe('buildSummarySource', () => {
  // Every field filled, as the create form can be after switching type.
  const VALUES = {
    typeName: 'thing',
    title: 'Title',
    content: 'some content',
    language: 'bash',
    url: 'https://example.com',
    tags: 'one, two',
    fileName: 'notes.pdf',
  };

  it('sends a snippet its content and language, and nothing that belongs to other types', () => {
    expect(buildSummarySource({ ...VALUES, slug: 'snippet' })).toEqual({
      title: 'Title',
      typeName: 'thing',
      content: 'some content',
      language: 'bash',
      url: undefined,
      fileName: undefined,
      tags: ['one', 'two'],
    });
  });

  it('sends a note its content with no language', () => {
    const source = buildSummarySource({ ...VALUES, slug: 'note' });

    expect(source.content).toBe('some content');
    expect(source.language).toBeUndefined();
  });

  it('sends a link its URL and no content', () => {
    const source = buildSummarySource({ ...VALUES, slug: 'link' });

    expect(source.url).toBe('https://example.com');
    expect(source.content).toBeUndefined();
    expect(source.fileName).toBeUndefined();
  });

  it('sends a file or image its file name and nothing typed for another type', () => {
    for (const slug of ['file', 'image']) {
      const source = buildSummarySource({ ...VALUES, slug });

      expect(source.fileName).toBe('notes.pdf');
      expect(source.content).toBeUndefined();
      expect(source.url).toBeUndefined();
    }
  });

  it('sends an upload with nothing picked yet no file name', () => {
    expect(buildSummarySource({ ...VALUES, slug: 'file', fileName: null }).fileName).toBeUndefined();
  });

  it('sends a custom type its title and tags only', () => {
    const source = buildSummarySource({ ...VALUES, slug: 'recipe' });

    expect(source).toMatchObject({ title: 'Title', tags: ['one', 'two'] });
    expect(source.content).toBeUndefined();
    expect(source.url).toBeUndefined();
    expect(source.fileName).toBeUndefined();
  });
});

describe('usesPromptOptimizer', () => {
  it('is the prompt type alone', () => {
    expect(usesPromptOptimizer('prompt')).toBe(true);
  });

  it('excludes the note, which shares the markdown editor, and every other type', () => {
    for (const slug of ['note', 'snippet', 'command', 'link', 'file', 'image', 'recipe']) {
      expect(usesPromptOptimizer(slug)).toBe(false);
    }
  });

  it('only ever applies to a type that gets the markdown editor', () => {
    expect(usesMarkdownEditor('prompt')).toBe(true);
  });
});
