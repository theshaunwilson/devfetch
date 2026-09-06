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
}

/**
 * The type-specific fields an item of this type cannot be created without, on
 * top of the title every item needs.
 *
 * Read off the same set as `editableFieldsFor` rather than a second list, so
 * the two cannot drift: a link with no URL is not a link, so a type that shows
 * the URL field is a type that requires it.
 */
export function requiredFieldsFor(slug: string): RequiredFields {
  return { url: TYPES_WITH_URL.has(slug) };
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

