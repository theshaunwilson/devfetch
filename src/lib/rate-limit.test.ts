/**
 * This module imports `server-only`, so it also proves the alias in
 * `vitest.config.ts` is working — without it the import throws before any
 * test runs.
 *
 * The pure helpers are covered directly. `checkRateLimit` and the two keying
 * wrappers talk to Upstash and to `next/headers`; those are exercised against
 * a real database, as recorded in the rate-limiting feature history.
 *
 * `checkAiRateLimit` is the exception, because it fails *closed* and that is
 * the property worth a test: the Upstash client is mocked, so each branch —
 * unconfigured, unreachable, timed out, over, under — can be driven without
 * a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_RATE_LIMITS,
  AUTH_RATE_LIMITS,
  aiRateLimitMessage,
  rateLimitMessage,
  retryAfterSeconds,
} from './rate-limit';

const limit = vi.fn();
const limiterOptions = vi.fn();

vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = vi.fn((tokens: number, window: string) => ({ tokens, window }));
    limit = limit;

    constructor(options: unknown) {
      limiterOptions(options);
    }
  }

  return { Ratelimit };
});

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

describe('AI_RATE_LIMITS', () => {
  it('allows 20 AI requests an hour', () => {
    expect(AI_RATE_LIMITS.ai).toEqual({ limit: 20, window: '1 h' });
  });
});

describe('aiRateLimitMessage', () => {
  it('names the wait in minutes, in its own wording rather than the auth one', () => {
    expect(aiRateLimitMessage(NOW + 30 * 60_000)).toBe(
      'You have used your AI requests for now. Try again in 30 minutes.',
    );
    expect(aiRateLimitMessage(NOW + 30_000)).toBe(
      'You have used your AI requests for now. Try again in a minute.',
    );
  });
});

describe('checkAiRateLimit', () => {
  /** A fresh module per test, so the cached limiters start empty. */
  async function loadModule() {
    vi.resetModules();

    return import('./rate-limit');
  }

  beforeEach(() => {
    limit.mockReset();
    limiterOptions.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows a user under the limit, keyed on their id under its own prefix', async () => {
    limit.mockResolvedValue({ success: true, remaining: 19, reset: NOW + 1000 });

    const { checkAiRateLimit } = await loadModule();

    await expect(checkAiRateLimit('user_1')).resolves.toEqual({ status: 'allowed' });
    expect(limit).toHaveBeenCalledWith('user_1');
    expect(limiterOptions).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'devfetch:ai' }));
  });

  it('reports a user over the limit with the reset time', async () => {
    limit.mockResolvedValue({ success: false, remaining: 0, reset: NOW + 5000 });

    const { checkAiRateLimit } = await loadModule();

    await expect(checkAiRateLimit('user_1')).resolves.toEqual({
      status: 'limited',
      reset: NOW + 5000,
    });
  });

  it('refuses when Upstash is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', undefined);

    const { checkAiRateLimit } = await loadModule();

    await expect(checkAiRateLimit('user_1')).resolves.toEqual({ status: 'unavailable' });
    expect(limit).not.toHaveBeenCalled();
  });

  it('refuses when Upstash throws', async () => {
    limit.mockRejectedValue(new Error('unreachable'));

    const { checkAiRateLimit } = await loadModule();

    await expect(checkAiRateLimit('user_1')).resolves.toEqual({ status: 'unavailable' });
  });

  it('refuses a timeout, which Upstash reports as a pass', async () => {
    limit.mockResolvedValue({ success: true, remaining: 20, reset: 0, reason: 'timeout' });

    const { checkAiRateLimit } = await loadModule();

    await expect(checkAiRateLimit('user_1')).resolves.toEqual({ status: 'unavailable' });
  });

  it('leaves the auth limits failing open and their keys unchanged', async () => {
    limit.mockRejectedValue(new Error('unreachable'));

    const { checkRateLimit } = await loadModule();

    await expect(checkRateLimit('signIn', '1.2.3.4')).resolves.toMatchObject({ success: true });
    expect(limiterOptions).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'devfetch:auth:signIn' }),
    );
  });
});
