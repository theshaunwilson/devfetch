import { canCreateType } from '@/lib/pro';
import { isImageUploadType, usesFileList, usesFileUpload } from '@/lib/uploads';
import type { GenerateSummaryInput } from '@/lib/validation/ai';
import { TAG_MAX_LENGTH, TAGS_MAX_COUNT } from '@/lib/validation/items';
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

/** Whether the tags input already holds `tag`, ignoring case and padding. */
export function hasTagInput(value: string, tag: string): boolean {
  const needle = tag.trim().toLowerCase();

  return parseTagInput(value).some((name) => name.toLowerCase() === needle);
}

/**
 * The tags input's text with one more tag on the end — an accepted suggestion.
 *
 * Re-formatted from the parsed list rather than concatenated, so a trailing
 * comma or stray spacing in what was typed does not leave `react,, hooks`
 * behind. A tag the input already holds, in any case, leaves it unchanged.
 */
export function appendTagInput(value: string, tag: string): string {
  const name = tag.trim();

  if (!name || hasTagInput(value, name)) return value;

  return formatTagInput([...parseTagInput(value), name]);
}

/**
 * The tags input's tags as an AI request may carry them: only what the save
 * would accept, so a form holding one over-long tag can still ask for AI help
 * — the save is where that gets reported.
 */
export function tagsForAi(value: string): string[] {
  return parseTagInput(value)
    .filter((tag) => tag.length <= TAG_MAX_LENGTH)
    .slice(0, TAGS_MAX_COUNT);
}

/** What the forms hold that a description could be written from. */
export interface SummarySourceValues {
  slug: string;
  typeName: string;
  title: string;
  content: string;
  language: string;
  url: string;
  tags: string;
  fileName: string | null;
}

/**
 * The request to write a description from, for any item type.
 *
 * Sends only what the selected type shows — the create form may still hold
 * text from a type picked earlier, which the save would not send either — so
 * a snippet sends its code and language, a link its URL, and a file or image
 * its file name, the only thing about an upload that is ever sent.
 */
export function buildSummarySource(values: SummarySourceValues): GenerateSummaryInput {
  const fields = editableFieldsFor(values.slug);

  return {
    title: values.title,
    typeName: values.typeName,
    content: fields.content ? values.content : undefined,
    language: fields.language ? values.language : undefined,
    url: fields.url ? values.url : undefined,
    fileName: usesFileUpload(values.slug) ? (values.fileName ?? undefined) : undefined,
    tags: tagsForAi(values.tags),
  };
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
 * is showing, which may have since been deleted — and, for a free account, may
 * be one of the two the viewer cannot create. `/items/file` renders a "New
 * File" button that passes `file`, so without the plan check here a free user
 * would open the dialog sitting on a disabled option with the submit blocked.
 *
 * So the preference is honoured only when the viewer can actually create it,
 * then the first type they can, then the first type at all — the last a
 * belt-and-braces arm that keeps the return a string even for an account
 * somehow offered nothing but Pro types.
 *
 * `types` must not be empty — the caller disables its trigger when there is
 * nothing to pick.
 */
export function initialTypeId<T extends { id: string; slug: string }>(
  types: readonly T[],
  slug: string | undefined,
  isPro: boolean,
): string {
  const preferred = types.find((type) => type.slug === slug);

  if (preferred && canCreateType(preferred.slug, isPro)) return preferred.id;

  return types.find((type) => canCreateType(type.slug, isPro))?.id ?? types[0].id;
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

/**
 * Whether this type's content is a prompt the AI can optimize. Only the prompt
 * type: a note is prose too and shares its editor, but rewriting somebody's
 * notes to be "better prompts" would be wrong for every one of them.
 */
export function usesPromptOptimizer(slug: string): boolean {
  return slug === 'prompt';
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

/** An item list split into the three shapes a mixed list renders it in. */
export interface GroupedItems<T> {
  /** Text-bodied items — snippets, prompts, commands, notes, links. */
  cards: T[];
  images: T[];
  files: T[];
}

/**
 * Splits a mixed list of items into the groups a collection page renders as its
 * own section.
 *
 * An uploaded image or file is a different kind of thing from a snippet or a
 * prompt, and shows a different shape — a thumbnail, or a row with a size and a
 * download. Interleaving them by date mixes three rhythms in one grid and, since
 * a full-width file row cannot start mid-row, leaves holes wherever one
 * interrupts. Grouping keeps each shape in a run of its own.
 *
 * Which group a type belongs to is read off `isImageUploadType` and
 * `usesFileList` rather than a list of its own, so the three groups partition
 * the types the same way the gallery and the file list already do — a type is
 * in exactly one, and a custom type falls to `cards` with every other
 * text-bodied type.
 *
 * Order within each group is the order it arrived in, so the caller's sort —
 * most recently updated first — survives the split.
 */
export function groupItemsByShape<T extends { type: { slug: string } }>(
  items: T[]
): GroupedItems<T> {
  const grouped: GroupedItems<T> = { cards: [], images: [], files: [] };

  for (const item of items) {
    const { slug } = item.type;

    if (isImageUploadType(slug)) grouped.images.push(item);
    else if (usesFileList(slug)) grouped.files.push(item);
    else grouped.cards.push(item);
  }

  return grouped;
}
