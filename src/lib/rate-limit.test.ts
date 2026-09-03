/**
 * This module imports `server-only`, so it also proves the alias in
 * `vitest.config.ts` is working — without it the import throws before any
 * test runs.
 *
 * Only the pure helpers are covered. `checkRateLimit` and the two keying
 * wrappers talk to Upstash and to `next/headers`; those are exercised against
 * a real database, as recorded in the rate-limiting feature history.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_RATE_LIMITS, rateLimitMessage, retryAfterSeconds } from './rate-limit';

const NOW = new Date('2026-09-03T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('retryAfterSeconds', () => {
  it('rounds up to whole seconds', () => {
    expect(retryAfterSeconds(NOW + 30_000)).toBe(30);
    expect(retryAfterSeconds(NOW + 30_001)).toBe(31);
  });

  it('never returns 0, so "try again in 0 seconds" is impossible', () => {
    expect(retryAfterSeconds(NOW)).toBe(1);
    expect(retryAfterSeconds(NOW - 60_000)).toBe(1);
  });
});

describe('rateLimitMessage', () => {
  it('says "in a minute" for a minute or less', () => {
    expect(rateLimitMessage(NOW + 1_000)).toBe('Too many attempts. Please try again in a minute.');
    expect(rateLimitMessage(NOW + 60_000)).toBe('Too many attempts. Please try again in a minute.');
  });

  it('switches to minutes past a minute, and singularizes correctly', () => {
    expect(rateLimitMessage(NOW + 61_000)).toBe('Too many attempts. Please try again in 2 minutes.');
    expect(rateLimitMessage(NOW + 15 * 60_000)).toBe(
      'Too many attempts. Please try again in 15 minutes.',
    );
  });

  it('always names a wait rather than only refusing', () => {
    expect(rateLimitMessage(NOW + 5 * 60_000)).toMatch(/try again in/);
  });
});

describe('AUTH_RATE_LIMITS', () => {
  it('covers every auth entry point', () => {
    expect(Object.keys(AUTH_RATE_LIMITS).sort()).toEqual([
      'forgotPassword',
      'register',
      'resendVerification',
      'resetPassword',
      'signIn',
    ]);
  });

  it('keeps the two email-sending actions tightest, since their abuse lands in a stranger s inbox', () => {
    expect(AUTH_RATE_LIMITS.forgotPassword.limit).toBeLessThanOrEqual(AUTH_RATE_LIMITS.signIn.limit);
    expect(AUTH_RATE_LIMITS.resendVerification.limit).toBeLessThanOrEqual(
      AUTH_RATE_LIMITS.signIn.limit,
    );
  });
});
