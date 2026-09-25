/**
 * What a file item is allowed to hold, and how its stored object is named.
 *
 * Deliberately free of `server-only` and of every server import: the upload
 * route validates with it, the browser component validates with it before
 * spending a megabyte on a request that would only be refused, and the tests
 * exercise it directly. The server copy is the one that counts.
 */

/** Item types whose content is an uploaded file rather than typed text. */
const TYPES_WITH_FILE = new Set(['file', 'image']);

/** Whether this type's content is an uploaded file. */
export function usesFileUpload(slug: string): boolean {
  return TYPES_WITH_FILE.has(slug);
}

/** Whether this type's file is an image, and so gets a preview rather than a file card. */
export function isImageUploadType(slug: string): boolean {
  return slug === 'image';
}

/**
 * Whether this type's items are listed as file rows rather than cards.
 *
 * Read off the two helpers above rather than a list of its own, so the gallery
 * and the file list partition the upload types instead of overlapping: an
 * upload type is one or the other, and a type that takes no upload is neither.
 */
export function usesFileList(slug: string): boolean {
  return usesFileUpload(slug) && !isImageUploadType(slug);
}

export interface UploadConstraints {
  /** Bytes. */
  maxSize: number;
  /** Lowercase, leading dot. */
  extensions: readonly string[];
  /** What `accept` on the file input is set to. */
  accept: string;
}

const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const FILE_MAX_SIZE = 10 * 1024 * 1024;

/**
 * The largest any upload can be, whatever its type.
 *
 * The per-type limit is the one that decides, but the route needs a ceiling it
 * can apply to the request body before reading it — the item type arrives
 * inside that body, so it is not known yet.
 */
export const MAX_UPLOAD_SIZE = FILE_MAX_SIZE;

/**
 * The canonical media type for each extension we accept.
 *
 * This is what the object is stored and served as — never the media type the
 * browser reported, which is attacker-controlled on a hand-rolled request and
 * unreliable even on an honest one. Serving a `.txt` as `text/html` because
 * the client said so would turn every upload into stored XSS.
 */
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const FILE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.toml': 'application/toml',
  '.ini': 'text/plain',
};

/**
 * Media types a browser is allowed to claim, on top of the canonical ones.
 *
 * A file picker reports the media type the operating system associates with
 * the extension, and for several of the accepted extensions there is no such
 * association at all — `.toml`, `.yaml` and `.md` commonly arrive as an empty
 * string or as `application/octet-stream`. Refusing those would reject files
 * the table plainly allows, so the extension decides and the reported type is
 * only checked for an outright contradiction.
 */
const UNSPECIFIC_TYPES = new Set(['', 'application/octet-stream']);

/** Media types the spec names for files, beyond the canonical one per extension. */
const EXTRA_ALLOWED_TYPES = new Set([
  'text/yaml',
  'text/xml',
  // Some pickers report .md this way.
  'text/x-markdown',
]);

export function uploadConstraintsFor(slug: string): UploadConstraints | null {
  if (!usesFileUpload(slug)) return null;

  const images = isImageUploadType(slug);
  const extensions = Object.keys(images ? IMAGE_TYPES : FILE_TYPES);

  return {
    maxSize: images ? IMAGE_MAX_SIZE : FILE_MAX_SIZE,
    extensions,
    accept: extensions.join(','),
  };
}

/** The lowercase extension of a filename, dot included; '' when it has none. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');

  // A leading dot is a dotfile, not an extension — ".env" has no extension.
  if (dot <= 0) return '';

  return fileName.slice(dot).toLowerCase();
}

/**
 * The media type an accepted upload is stored and served as, derived from its
 * extension. Null when the extension is not accepted for this type.
 */
export function contentTypeFor(slug: string, fileName: string): string | null {
  if (!usesFileUpload(slug)) return null;

  const types = isImageUploadType(slug) ? IMAGE_TYPES : FILE_TYPES;

  return types[extensionOf(fileName)] ?? null;
}

/** Bytes as a short human string, e.g. "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  // Whole numbers below 10 still read better with a decimal ("1.4 MB"), and
  // above it the decimal is noise ("512 KB").
  return `${size >= 10 ? Math.round(size) : Math.round(size * 10) / 10} ${units[unit]}`;
}

export type UploadCheck = { ok: true; contentType: string } | { ok: false; error: string };

export interface UploadCandidate {
  /** The item type's slug — decides which table of limits applies. */
  slug: string;
  fileName: string;
  /** What the browser reported. Untrusted, and often absent. */
  reportedType: string;
  size: number;
}

/**
 * Whether this file may be uploaded for this item type, and what it will be
 * stored as.
 *
 * The extension is what decides, because it is the only part of the claim we
 * keep: the stored media type is derived from it, so an accepted extension can
 * never be served as something else. The reported media type is checked after,
 * and only to catch a contradiction — a `.png` announced as `application/pdf`
 * is a mismatch worth refusing, while a `.toml` announced as nothing at all is
 * ordinary.
 */
export function validateUpload({
  slug,
  fileName,
  reportedType,
  size,
}: UploadCandidate): UploadCheck {
  const constraints = uploadConstraintsFor(slug);

  if (!constraints) {
    return { ok: false, error: 'This item type does not take a file.' };
  }

  const contentType = contentTypeFor(slug, fileName);

  if (!contentType) {
    return {
      ok: false,
      error: `Accepted file types: ${constraints.extensions.join(', ')}`,
    };
  }

  const reported = reportedType.trim().toLowerCase();

  if (
    !UNSPECIFIC_TYPES.has(reported) &&
    reported !== contentType &&
    !EXTRA_ALLOWED_TYPES.has(reported)
  ) {
    return { ok: false, error: 'That file’s type does not match its extension.' };
  }

  if (size <= 0) {
    return { ok: false, error: 'That file is empty.' };
  }

  if (size > constraints.maxSize) {
    return {
      ok: false,
      error: `That file is too large. The limit is ${formatFileSize(constraints.maxSize)}.`,
    };
  }

  return { ok: true, contentType };
}

/**
 * Where one user's objects live. The trailing slash is part of the boundary —
 * without it `users/user_1` would also match `users/user_10/…`.
 *
 * Throws on an empty id rather than returning `users//`, since the one caller
 * that deletes by prefix must never be handed a prefix that names nobody.
 */
export function userKeyPrefix(userId: string): string {
  if (!userId) throw new Error('A key prefix needs a user id');

  return `users/${userId}/`;
}

/**
 * The key a new object is stored under.
 *
 * The uploader's own filename is kept out of the key entirely and lives in
 * `Item.fileName` instead: it can contain slashes, dots and control characters,
 * and none of that belongs in a path. Only the extension survives, and only
 * after `validateUpload` has accepted it.
 */
export function buildObjectKey(userId: string, extension: string, id: string): string {
  return `${userKeyPrefix(userId)}${id}${extension}`;
}

/**
 * Whether a key names an object this user uploaded.
 *
 * This is load-bearing, not a tidiness check. The key arrives from the client
 * when the item is created, and every later read is authorised by owning the
 * *item* — so without this, a caller could create an item of their own
 * pointing at somebody else's object and then download it through the proxy
 * quite legitimately.
 *
 * Matched exactly rather than by prefix alone: a bare `startsWith` would accept
 * a deeper path, and `users/<id>/../<other>/x.png` starts with the right
 * characters while naming something else entirely.
 */
export function keyBelongsTo(key: string, userId: string): boolean {
  if (!userId || !key.startsWith(userKeyPrefix(userId))) return false;

  const rest = key.slice(userKeyPrefix(userId).length);

  // One path segment, no traversal, and an extension we would have minted.
  return /^[A-Za-z0-9-]+\.[a-z0-9]+$/.test(rest);
}
