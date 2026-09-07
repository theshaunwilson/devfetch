/**
 * The rules an upload has to satisfy, and the shape of the key it is stored
 * under. Both halves are security-relevant rather than cosmetic: the extension
 * is what decides the media type the download proxy serves, and the key is what
 * stops one user's item naming another user's object.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_UPLOAD_SIZE,
  buildObjectKey,
  contentTypeFor,
  extensionOf,
  formatFileSize,
  isImageUploadType,
  keyBelongsTo,
  uploadConstraintsFor,
  usesFileUpload,
  validateUpload,
} from './uploads';

const USER = 'user_1';
const MB = 1024 * 1024;

describe('usesFileUpload', () => {
  it('is true for exactly the two types whose content is a file', () => {
    expect(usesFileUpload('file')).toBe(true);
    expect(usesFileUpload('image')).toBe(true);
  });

  it('is false for every type that holds typed content instead', () => {
    for (const slug of ['snippet', 'prompt', 'command', 'note', 'link']) {
      expect(usesFileUpload(slug)).toBe(false);
    }
  });

  it('is false for a custom type, which gets no file input', () => {
    expect(usesFileUpload('recipe')).toBe(false);
  });
});

describe('isImageUploadType', () => {
  it('separates the two file types, which have different limits', () => {
    expect(isImageUploadType('image')).toBe(true);
    expect(isImageUploadType('file')).toBe(false);
  });
});

describe('uploadConstraintsFor', () => {
  it('gives images the 5 MB ceiling and the six image extensions', () => {
    const constraints = uploadConstraintsFor('image');

    expect(constraints?.maxSize).toBe(5 * MB);
    expect(constraints?.extensions).toEqual([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
    ]);
  });

  it('gives files the 10 MB ceiling and the ten file extensions', () => {
    const constraints = uploadConstraintsFor('file');

    expect(constraints?.maxSize).toBe(10 * MB);
    expect(constraints?.extensions).toHaveLength(10);
    expect(constraints?.extensions).toContain('.toml');
  });

  it('returns null for a type that takes no file at all', () => {
    expect(uploadConstraintsFor('snippet')).toBeNull();
  });

  it('offers the extensions to the file input as its accept list', () => {
    expect(uploadConstraintsFor('image')?.accept).toBe('.png,.jpg,.jpeg,.gif,.webp,.svg');
  });
});

describe('extensionOf', () => {
  it('lowercases, so a .PNG is the same extension as a .png', () => {
    expect(extensionOf('Photo.PNG')).toBe('.png');
  });

  it('takes the last dot, so a doubled extension is read as its real one', () => {
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
  });

  it('reads a dotfile as having no extension rather than as being one', () => {
    // Without the guard ".env" would read as the extension ".env", and an
    // allowlist keyed on extensions would be asked a nonsense question.
    expect(extensionOf('.env')).toBe('');
  });

  it('returns empty for a name with no dot at all', () => {
    expect(extensionOf('README')).toBe('');
  });
});

describe('contentTypeFor', () => {
  it('maps each accepted extension to the type it is served as', () => {
    expect(contentTypeFor('image', 'a.png')).toBe('image/png');
    expect(contentTypeFor('image', 'a.jpeg')).toBe('image/jpeg');
    expect(contentTypeFor('file', 'a.md')).toBe('text/markdown');
    expect(contentTypeFor('file', 'a.ini')).toBe('text/plain');
  });

  it('treats .jpg and .jpeg as one media type', () => {
    expect(contentTypeFor('image', 'a.jpg')).toBe(contentTypeFor('image', 'a.jpeg'));
  });

  it('keeps the two tables apart, so an image extension is not a file extension', () => {
    expect(contentTypeFor('file', 'a.png')).toBeNull();
    expect(contentTypeFor('image', 'a.pdf')).toBeNull();
  });

  it('never resolves .html, so an upload cannot be served as a document', () => {
    // This is the reason the media type is derived rather than trusted: an
    // object served as text/html from our own origin would be stored XSS.
    expect(contentTypeFor('file', 'evil.html')).toBeNull();
    expect(contentTypeFor('image', 'evil.html')).toBeNull();
  });

  it('returns null for a type that takes no file', () => {
    expect(contentTypeFor('note', 'a.md')).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('leaves small sizes in bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('keeps one decimal below ten, where it carries information', () => {
    expect(formatFileSize(1.4 * MB)).toBe('1.4 MB');
  });

  it('drops the decimal above ten, where it is noise', () => {
    expect(formatFileSize(512 * 1024)).toBe('512 KB');
  });

  it('names the limits the way the upload hint does', () => {
    expect(formatFileSize(5 * MB)).toBe('5 MB');
    expect(formatFileSize(10 * MB)).toBe('10 MB');
  });
});

describe('validateUpload', () => {
  const png = { slug: 'image', fileName: 'shot.png', reportedType: 'image/png', size: 1000 };

  it('accepts a file the table allows and says what it will be stored as', () => {
    expect(validateUpload(png)).toEqual({ ok: true, contentType: 'image/png' });
  });

  it('refuses an extension the type does not accept', () => {
    const result = validateUpload({ ...png, fileName: 'doc.pdf' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('.png');
  });

  it('refuses a file for a type that takes none', () => {
    expect(validateUpload({ ...png, slug: 'snippet' }).ok).toBe(false);
  });

  it('accepts an empty reported type, which is what .toml and .yaml arrive as', () => {
    // The operating system has no association for these, so the picker reports
    // nothing. Refusing that would reject files the table plainly allows.
    expect(validateUpload({ slug: 'file', fileName: 'c.toml', reportedType: '', size: 10 })).toEqual(
      { ok: true, contentType: 'application/toml' },
    );
  });

  it('accepts application/octet-stream for the same reason', () => {
    expect(
      validateUpload({
        slug: 'file',
        fileName: 'c.yaml',
        reportedType: 'application/octet-stream',
        size: 10,
      }).ok,
    ).toBe(true);
  });

  it('accepts the alternate media types the spec lists', () => {
    expect(
      validateUpload({ slug: 'file', fileName: 'c.yml', reportedType: 'text/yaml', size: 10 }).ok,
    ).toBe(true);
    expect(
      validateUpload({ slug: 'file', fileName: 'c.xml', reportedType: 'text/xml', size: 10 }).ok,
    ).toBe(true);
  });

  it('refuses a reported type that contradicts the extension', () => {
    expect(validateUpload({ ...png, reportedType: 'application/pdf' }).ok).toBe(false);
  });

  it('stores what the extension says even so, never what was reported', () => {
    // A hand-rolled request can claim anything; the extension is the only part
    // of the claim that survives into the stored object. `text/yaml` is an
    // accepted claim for a .yml *and* differs from what we store it as, which
    // is what makes this the discriminating case — a reported type that merely
    // matches the canonical one would pass either way.
    const result = validateUpload({
      slug: 'file',
      fileName: 'compose.yml',
      reportedType: 'text/yaml',
      size: 10,
    });

    expect(result).toEqual({ ok: true, contentType: 'application/x-yaml' });
  });

  it('ignores the case of a reported type rather than refusing it', () => {
    expect(validateUpload({ ...png, reportedType: 'IMAGE/PNG' })).toEqual({
      ok: true,
      contentType: 'image/png',
    });
  });

  it('refuses an empty file', () => {
    expect(validateUpload({ ...png, size: 0 }).ok).toBe(false);
  });

  it('holds images to 5 MB', () => {
    expect(validateUpload({ ...png, size: 5 * MB }).ok).toBe(true);
    expect(validateUpload({ ...png, size: 5 * MB + 1 }).ok).toBe(false);
  });

  it('holds files to 10 MB, so the two limits really do differ', () => {
    const pdf = { slug: 'file', fileName: 'a.pdf', reportedType: 'application/pdf' };

    expect(validateUpload({ ...pdf, size: 10 * MB }).ok).toBe(true);
    expect(validateUpload({ ...pdf, size: 10 * MB + 1 }).ok).toBe(false);
    // An image of the same size is over its own, lower limit.
    expect(validateUpload({ ...png, size: 6 * MB }).ok).toBe(false);
  });

  it('names the limit that applied, not the other one', () => {
    const result = validateUpload({ ...png, size: 6 * MB });

    expect(result.ok === false && result.error).toContain('5 MB');
  });
});

describe('MAX_UPLOAD_SIZE', () => {
  it('is the larger of the two limits, since the route applies it before the type is known', () => {
    expect(MAX_UPLOAD_SIZE).toBe(10 * MB);
  });
});

describe('buildObjectKey', () => {
  it('files the object under its owner', () => {
    expect(buildObjectKey(USER, '.png', 'abc-123')).toBe('users/user_1/abc-123.png');
  });

  it('produces a key that passes its own ownership check', () => {
    expect(keyBelongsTo(buildObjectKey(USER, '.png', 'abc-123'), USER)).toBe(true);
  });
});

describe('keyBelongsTo', () => {
  it('accepts a key under this user', () => {
    expect(keyBelongsTo('users/user_1/abc-123.png', USER)).toBe(true);
  });

  it('refuses a key under a different user', () => {
    // The whole point: the key arrives from the client at create time, and
    // every later read is authorised by owning the item that names it.
    expect(keyBelongsTo('users/user_2/abc-123.png', USER)).toBe(false);
  });

  it('refuses traversal back out of the user’s own prefix', () => {
    // Starts with the right characters and names something else entirely,
    // which is exactly what a bare startsWith would let through.
    expect(keyBelongsTo('users/user_1/../user_2/abc.png', USER)).toBe(false);
  });

  it('refuses a deeper path under the prefix', () => {
    expect(keyBelongsTo('users/user_1/nested/abc.png', USER)).toBe(false);
  });

  it('refuses a user id that is only a prefix of another', () => {
    // Without the trailing slash in the boundary, user_1 would own user_10's
    // objects.
    expect(keyBelongsTo('users/user_10/abc.png', USER)).toBe(false);
  });

  it('refuses a key with no extension', () => {
    expect(keyBelongsTo('users/user_1/abc', USER)).toBe(false);
  });

  it('refuses everything when there is no user', () => {
    expect(keyBelongsTo('users//abc.png', '')).toBe(false);
  });
});
