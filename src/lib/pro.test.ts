import { describe, expect, it } from 'vitest';

import { isProType } from './pro';

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
