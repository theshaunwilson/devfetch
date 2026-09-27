/**
 * `absoluteUrl` builds the links in verification and password-reset emails, so
 * what it does when `APP_URL` is unset — and *when* it reads it — is the part
 * worth pinning. Same env-stubbing pattern as `features.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { absoluteUrl } from './app-url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('absoluteUrl', () => {
  it('builds an absolute URL on the configured origin', () => {
    vi.stubEnv('APP_URL', 'https://devfetch.site');

    expect(absoluteUrl('/verify-email?token=abc')).toBe('https://devfetch.site/verify-email?token=abc');
  });

  /**
   * Read at call time, never at module scope: a value captured at import would
   * be whatever `next build` happened to see, and this module is imported by
   * route code that is loaded during the build.
   */
  it('reads the environment on every call, so a build cannot bake one in', () => {
    vi.stubEnv('APP_URL', 'https://first.example');
    expect(absoluteUrl('/reset-password')).toBe('https://first.example/reset-password');

    vi.stubEnv('APP_URL', 'https://second.example');
    expect(absoluteUrl('/reset-password')).toBe('https://second.example/reset-password');
  });

  it('falls back to localhost when unset, which is a development convenience only', () => {
    vi.stubEnv('APP_URL', undefined);

    // Deployed without APP_URL, this is the link every email would carry.
    expect(absoluteUrl('/verify-email')).toBe('http://localhost:3000/verify-email');
  });

  it('keeps a trailing path segment on a base that has one', () => {
    vi.stubEnv('APP_URL', 'https://devfetch.site/app/');

    expect(absoluteUrl('verify-email')).toBe('https://devfetch.site/app/verify-email');
  });
});
