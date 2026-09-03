import { describe, expect, it } from 'vitest';

import { DEFAULT_SIGNED_IN_PATH, safeCallbackUrl } from './auth-redirect';

describe('safeCallbackUrl', () => {
  it('keeps a same-origin path', () => {
    expect(safeCallbackUrl('/items/snippet')).toBe('/items/snippet');
    expect(safeCallbackUrl('/profile?tab=security')).toBe('/profile?tab=security');
  });

  it('rejects a protocol-relative URL, which starts with a slash but leaves the site', () => {
    // The open-redirect this function exists to stop.
    expect(safeCallbackUrl('//evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeCallbackUrl('//evil.example/dashboard')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('rejects an absolute URL', () => {
    expect(safeCallbackUrl('https://evil.example/dashboard')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeCallbackUrl('http://localhost:3000/dashboard')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('rejects a scheme with no slashes at all', () => {
    expect(safeCallbackUrl('javascript:alert(1)')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeCallbackUrl('dashboard')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('rejects anything that is not a string, since it comes off a URL', () => {
    expect(safeCallbackUrl(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeCallbackUrl(null)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeCallbackUrl(['/dashboard'])).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
