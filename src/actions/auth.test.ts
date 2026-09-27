/**
 * Proof of concept for testing a server action.
 *
 * A server action is a public endpoint, so it is worth unit testing — but
 * `src/actions/auth.ts` reaches NextAuth, Prisma, Upstash and Resend at import
 * time. `src/lib/prisma.ts` in particular throws the moment it is imported
 * without `DATABASE_URL`. Every one of those edges is mocked below, so this
 * file runs with no database, no Redis and no environment, and never touches
 * the Neon branch.
 *
 * The pattern to copy: mock the module boundary (`@/auth`, `@/lib/prisma`),
 * not the library behind it, and leave the pure modules — the Zod schemas,
 * `auth-redirect`, `auth-errors` — real, so the action is tested against the
 * same rules production runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMAIL_NOT_VERIFIED_CODE, EMAIL_NOT_VERIFIED_MESSAGE } from '@/lib/auth-errors';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/auth-redirect';

vi.mock('@/auth', async () => {
  const { CredentialsSignin } = await import('next-auth');

  // A real subclass, not a stand-in: the action narrows with `instanceof`,
  // so the prototype chain back to AuthError is the thing under test.
  class RateLimitedError extends CredentialsSignin {
    code = 'rate_limited';

    constructor(readonly reset: number) {
      super();
    }
  }

  return { signIn: vi.fn(), signOut: vi.fn(), RateLimitedError };
});

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkIpRateLimit: vi.fn(async () => ({ success: true, remaining: 9, reset: 0 })),
  checkIpEmailRateLimit: vi.fn(async () => ({ success: true, remaining: 9, reset: 0 })),
  rateLimitMessage: vi.fn(() => 'Too many attempts. Please try again in 15 minutes.'),
}));

vi.mock('@/lib/email/verification', () => ({ sendVerificationEmail: vi.fn() }));
vi.mock('@/lib/email/password-reset', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('@/lib/auth/password-reset-token', () => ({ consumePasswordResetToken: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { signIn, RateLimitedError } = await import('@/auth');
const { signInWithCredentials } = await import('./auth');

const INVALID_CREDENTIALS = 'Invalid email or password';

const formData = (fields: Record<string, string>) => {
  const data = new FormData();

  for (const [key, value] of Object.entries(fields)) data.append(key, value);

  return data;
};

const submit = (fields: Record<string, string>) => signInWithCredentials({}, formData(fields));

/** The generic `CredentialsSignin` Auth.js raises for any ordinary failure. */
const credentialsError = async (code?: string) => {
  const { CredentialsSignin } = await import('next-auth');
  const error = new CredentialsSignin();

  if (code) error.code = code;

  return error;
};

beforeEach(() => {
  vi.mocked(signIn).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('signInWithCredentials', () => {
  it('signs in with the normalized credentials and the requested path', async () => {
    const state = await submit({
      email: '  DEMO@DevFetch.site ',
      password: '12345678',
      callbackUrl: '/items/snippet',
    });

    expect(state).toEqual({});
    expect(signIn).toHaveBeenCalledWith('credentials', {
      // Normalized by the schema before it reaches Auth.js — Postgres compares
      // User.email case-sensitively.
      email: 'demo@devfetch.site',
      password: '12345678',
      redirectTo: '/items/snippet',
    });
  });

  it('refuses to redirect off-site, whatever the form asked for', async () => {
    await submit({
      email: 'demo@devfetch.site',
      password: '12345678',
      callbackUrl: '//evil.example',
    });

    expect(signIn).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({ redirectTo: DEFAULT_SIGNED_IN_PATH }),
    );
  });

  it('rejects a malformed email without ever calling signIn', async () => {
    const state = await submit({ email: 'not-an-email', password: '12345678' });

    expect(state.error).toBe(INVALID_CREDENTIALS);
    expect(state.fieldErrors?.email).toBeDefined();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('does not report the password policy on a short password', async () => {
    // signInSchema is deliberately looser than registerSchema: complaining
    // here would name the rule instead of refusing.
    const state = await submit({ email: 'demo@devfetch.site', password: 'a' });

    expect(state.fieldErrors?.password).toBeUndefined();
    expect(signIn).toHaveBeenCalled();
  });

  it('echoes the email back as typed, so a failed attempt does not blank the form', async () => {
    // React resets an uncontrolled form once the action resolves. The value is
    // echoed unnormalized so the field does not rewrite itself under the user.
    vi.mocked(signIn).mockRejectedValue(await credentialsError());

    const state = await submit({ email: '  DEMO@DevFetch.site ', password: 'wrong-password' });

    expect(state.email).toBe('  DEMO@DevFetch.site ');
  });

  it('never carries the password back', async () => {
    vi.mocked(signIn).mockRejectedValue(await credentialsError());

    const state = await submit({ email: 'demo@devfetch.site', password: 'hunter22' });

    expect(JSON.stringify(state)).not.toContain('hunter22');
  });

  it('gives one generic message to a wrong password, offering no resend', async () => {
    vi.mocked(signIn).mockRejectedValue(await credentialsError());

    const state = await submit({ email: 'demo@devfetch.site', password: 'wrong-password' });

    expect(state.error).toBe(INVALID_CREDENTIALS);
    expect(state.canResend).toBeUndefined();
  });

  it('names the unverified case and offers a resend, but only for a correct password', async () => {
    // `authorize` raises this after the bcrypt comparison, never before it, so
    // reaching here already proves the account is the caller s.
    vi.mocked(signIn).mockRejectedValue(await credentialsError(EMAIL_NOT_VERIFIED_CODE));

    const state = await submit({ email: 'demo@devfetch.site', password: '12345678' });

    expect(state.error).toBe(EMAIL_NOT_VERIFIED_MESSAGE);
    expect(state.canResend).toBe(true);
  });

  it('reports the wait when the sign-in budget is spent', async () => {
    const reset = Date.now() + 15 * 60_000;

    vi.mocked(signIn).mockRejectedValue(new RateLimitedError(reset));

    const state = await submit({ email: 'demo@devfetch.site', password: '12345678' });

    expect(state.error).toBe('Too many attempts. Please try again in 15 minutes.');
    expect(state.canResend).toBeUndefined();
  });

  it('rethrows a non-auth error, since a successful sign-in throws NEXT_REDIRECT', async () => {
    // Swallowing this would leave the user on the sign-in page after a
    // successful sign-in.
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;...' });

    vi.mocked(signIn).mockRejectedValue(redirectError);

    await expect(submit({ email: 'demo@devfetch.site', password: '12345678' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );
  });
});
