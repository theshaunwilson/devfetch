import { usesFileUpload } from '@/lib/uploads';
import type { CreateItemInput } from '@/lib/validation/items';

/**
 * Which of the type-specific fields the edit form shows, keyed on the item
 * type's slug.
 *
 * Slugs rather than names: a name is user-facing text and `@@unique([userId,
 * slug])` lets a custom type reuse a system slug, so the slug is the stable
 * identifier. A custom type matches none of these and gets the fields every
 * item has — title, description and tags.
 */
const TYPES_WITH_CONTENT = new Set(['snippet', 'prompt', 'command', 'note']);
const TYPES_WITH_LANGUAGE = new Set(['snippet', 'command']);
const TYPES_WITH_URL = new Set(['link']);

export interface EditableFields {
  content: boolean;
  language: boolean;
  url: boolean;
}

/** The type-specific fields an item of this type can edit. */
export function editableFieldsFor(slug: string): EditableFields {
  return {
    content: TYPES_WITH_CONTENT.has(slug),
    language: TYPES_WITH_LANGUAGE.has(slug),
    url: TYPES_WITH_URL.has(slug),
  };
}

export interface RequiredFields {
  url: boolean;
  file: boolean;
}

/**
 * The type-specific fields an item of this type cannot be created without, on
 * top of the title every item needs.
 *
 * Read off the same sets the fields themselves come from rather than lists of
 * its own, so the two cannot drift: a link with no URL is not a link and a file
 * item with no file is nothing at all, so a type that shows one of those inputs
 * is a type that requires it.
 *
 * `file` is not in `EditableFields` alongside it, because an uploaded file is
 * not editable — a file item's edit form shows the title, description and tags
 * every item has, and replacing the file is not something this feature does.
 */
export function requiredFieldsFor(slug: string): RequiredFields {
  return { url: TYPES_WITH_URL.has(slug), file: usesFileUpload(slug) };
}

/**
 * Turns the tags input's comma-separated text into the array the server takes.
 *
 * Blank entries are dropped rather than reported, since a trailing comma is a
 * normal thing to type. Duplicates are dropped too, because the join rows are
 * keyed on [itemId, tagId] — the schema does this again on the server, which is
 * the copy that counts.
 */
export function parseTagInput(value: string): string[] {
  const seen = new Set<string>();

  return value.split(',').reduce<string[]>((tags, part) => {
    const name = part.trim();

    if (name && !seen.has(name)) {
      seen.add(name);
      tags.push(name);
    }

    return tags;
  }, []);
}

/** The tags input's text for an item's current tags. */
export function formatTagInput(tags: string[]): string {
  return tags.join(', ');
}

/**
 * Whether this type's content is code, and so gets the Monaco editor rather
 * than a plain textarea.
 *
 * Read off `TYPES_WITH_LANGUAGE` rather than a list of its own, for the same
 * reason `requiredFieldsFor` is: a type whose content has a language is a type
 * whose content is code, so the two cannot drift apart. Notes and prompts keep
 * the textarea — prose is not improved by a gutter and a cursor that snaps to
 * tokens.
 */
export function usesCodeEditor(slug: string): boolean {
  return TYPES_WITH_LANGUAGE.has(slug);
}

/**
 * Which type a new-item form opens on.
 *
 * `slug` is a preference, not a guarantee: the items page passes the type it
 * is showing, but the offered list excludes the Pro types and could not
 * include a type that has since been deleted. Anything unmatched falls back to
 * the first offered type, so the selector can never open on nothing.
 *
 * `types` must not be empty — the caller disables its trigger when there is
 * nothing to pick.
 */
export function initialTypeId<T extends { id: string; slug: string }>(
  types: readonly T[],
  slug?: string,
): string {
  return types.find((type) => type.slug === slug)?.id ?? types[0].id;
}

/**
 * Whether this type's content is prose, and so gets the markdown editor rather
 * than a plain textarea.
 *
 * Derived rather than listed, for the same reason `usesCodeEditor` is: a type
 * with content that is not code is a type whose content is prose, so the two
 * cannot drift into a type that gets both editors or neither. Snippets and
 * commands keep Monaco; links have no content at all.
 */
export function usesMarkdownEditor(slug: string): boolean {
  return TYPES_WITH_CONTENT.has(slug) && !TYPES_WITH_LANGUAGE.has(slug);
}

/** Which field a copy button puts on the clipboard, or null for a type with no body. */
export type CopyableField = 'content' | 'url';

/**
 * What a card's copy button copies for this type, or null when there is
 * nothing to copy and so no button.
 *
 * Read off `editableFieldsFor` rather than a list of its own, for the same
 * reason `requiredFieldsFor` and `usesCodeEditor` are: a type whose body can
 * be edited is a type whose body can be copied, so the two cannot drift into a
 * card offering to copy a field its item never has. A link holds its URL and
 * no content; file and image items hold an uploaded object, and a custom type
 * holds neither — none of the three get a button.
 */
export function copyableFieldFor(slug: string): CopyableField | null {
  const fields = editableFieldsFor(slug);

  if (fields.url) return 'url';
  if (fields.content) return 'content';

  return null;
}

/** The raw form values a create dialog holds, before they become a payload. */
export interface NewItemValues {
  typeId: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  language: string;
  url: string;
  tags: string;
  /** The collections ticked in the picker, by id. */
  collectionIds: string[];
  file: { key: string; fileName: string; fileSize: number } | null;
}

/**
 * Turns what the create form holds into the payload the action takes.
 *
 * The rule worth keeping honest is omit-versus-blank: a field this type never
 * rendered is left **off the object entirely** rather than sent as an empty
 * string. On a create the two happen to mean the same thing, but `updateItem`
 * reads `undefined` as "leave alone" and `null` as "clear", and sending a
 * blank for a field the user never saw is how a save silently wipes a column.
 * Keeping create honest keeps the two payloads reading the same way.
 *
 * The file trio is set together or not at all — the three only mean anything
 * as a set, and `fileUrl` holds the object's key rather than a URL, since
 * uploads are private and are read back through `/api/files/[id]`.
 */
export function buildCreateItemPayload(values: NewItemValues): CreateItemInput {
  const fields = editableFieldsFor(values.slug);
  const required = requiredFieldsFor(values.slug);

  const payload: CreateItemInput = {
    typeId: values.typeId,
    title: values.title,
    description: values.description,
    tags: parseTagInput(values.tags),
    // Always sent, unlike the type-specific fields: every type can be filed in
    // collections, so an empty array is an answer ("in none") rather than a
    // field this form never showed.
    collectionIds: values.collectionIds,
  };

  if (fields.content) payload.content = values.content;
  if (fields.language) payload.language = values.language;
  if (fields.url) payload.url = values.url;

  if (required.file && values.file) {
    payload.fileUrl = values.file.key;
    payload.fileName = values.file.fileName;
    payload.fileSize = values.file.fileSize;
  }

  return payload;
}
