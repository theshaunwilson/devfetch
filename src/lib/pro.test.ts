import { describe, expect, it } from 'vitest';

import { canCreateType, isProType } from './pro';

describe('isProType', () => {
  it('marks file and image as Pro', () => {
    expect(isProType('file')).toBe(true);
    expect(isProType('image')).toBe(true);
  });

  it.each(['snippet', 'prompt', 'note', 'command', 'link'])('leaves %s on the free tier', (slug) => {
    expect(isProType(slug)).toBe(false);
  });

  it('does not treat a custom slug as Pro on the strength of its name', () => {
    expect(isProType('image-gallery')).toBe(false);
    expect(isProType('File')).toBe(false);
  });
});

describe('canCreateType', () => {
  it('lets a free account create the five text types', () => {
    for (const slug of ['snippet', 'prompt', 'note', 'command', 'link']) {
      expect(canCreateType(slug, false)).toBe(true);
    }
  });

  it('refuses the two upload types to a free account', () => {
    expect(canCreateType('file', false)).toBe(false);
    expect(canCreateType('image', false)).toBe(false);
  });

  it('lets Pro create every type, uploads included', () => {
    for (const slug of ['snippet', 'file', 'image', 'recipe']) {
      expect(canCreateType(slug, true)).toBe(true);
    }
  });

  it('reads off the same set `isProType` does, so the two cannot drift', () => {
    // A type is creatable by a free account exactly when it is not a Pro type.
    for (const slug of ['snippet', 'prompt', 'note', 'command', 'link', 'file', 'image']) {
      expect(canCreateType(slug, false)).toBe(!isProType(slug));
    }
  });
});
