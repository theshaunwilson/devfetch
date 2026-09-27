import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from './auth';

const VALID_PASSWORD = 'correct horse battery';

describe('email normalization', () => {
  it('trims and lower-cases before validating', () => {
    // Zod validates before it transforms, so a chained `z.email().trim()`
    // would reject this instead of cleaning it. The pipe is what fixes it.
    const parsed = signInSchema.safeParse({ email: '  TEST@Test.com  ', password: 'x' });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.email).toBe('test@test.com');
  });

  it('still rejects a malformed address after trimming', () => {
    expect(signInSchema.safeParse({ email: '  not-an-email  ', password: 'x' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'a@' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('password rules', () => {
  const register = (password: string) =>
    registerSchema.safeParse({
      name: 'Demo User',
      email: 'demo@devfetch.site',
      password,
      confirmPassword: password,
    });

  it(`requires at least ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(register('1234567').success).toBe(false);
    expect(register('12345678').success).toBe(true);
  });

  it(`accepts exactly ${PASSWORD_MAX_BYTES} bytes`, () => {
    expect(register('a'.repeat(PASSWORD_MAX_BYTES)).success).toBe(true);
  });

  it('rejects one byte over the bcrypt cap', () => {
    // Past 72 bytes bcrypt silently ignores the rest, so a longer password
    // would also authenticate with everything after the 72nd byte changed.
    expect(register('a'.repeat(PASSWORD_MAX_BYTES + 1)).success).toBe(false);
  });

  it('counts bytes, not characters', () => {
    // 19 emoji are 19 characters and 76 bytes.
    const emoji = '\u{1F600}'.repeat(19);

    expect(emoji.length).toBeLessThanOrEqual(PASSWORD_MAX_BYTES);
    expect(new TextEncoder().encode(emoji).length).toBeGreaterThan(PASSWORD_MAX_BYTES);
    expect(register(emoji).success).toBe(false);

    // 18 of them fit, at 72 bytes exactly.
    expect(register('\u{1F600}'.repeat(18)).success).toBe(true);
  });
});

describe('registerSchema', () => {
  const base = { email: 'demo@devfetch.site', password: VALID_PASSWORD };

  it('accepts a complete registration', () => {
    const parsed = registerSchema.safeParse({
      ...base,
      name: '  Demo User  ',
      confirmPassword: VALID_PASSWORD,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.name).toBe('Demo User');
  });

  it('reports a mismatch against confirmPassword, not password', () => {
    const parsed = registerSchema.safeParse({
      ...base,
      name: 'Demo User',
      confirmPassword: 'something else',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['confirmPassword']);
    expect(parsed.error?.issues[0].message).toBe('Passwords do not match');
  });

  it('requires a name that is more than whitespace', () => {
    expect(
      registerSchema.safeParse({ ...base, name: '   ', confirmPassword: VALID_PASSWORD }).success,
    ).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts a password shorter than the register floor', () => {
    // Deliberately looser: rejecting a short password here would report the
    // policy rather than "invalid credentials".
    expect(signInSchema.safeParse({ email: 'demo@devfetch.site', password: 'a' }).success).toBe(true);
  });

  it('still requires a password to be present', () => {
    expect(signInSchema.safeParse({ email: 'demo@devfetch.site', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('shares the mismatch rule with registerSchema', () => {
    const parsed = resetPasswordSchema.safeParse({
      password: VALID_PASSWORD,
      confirmPassword: 'other',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['confirmPassword']);
  });

  it('enforces the full password rules on the new password', () => {
    expect(resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success).toBe(
      false,
    );
  });
});

describe('changePasswordSchema', () => {
  it('requires the current password but does not apply the policy to it', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: 'a',
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an empty current password', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: '',
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('Enter your current password');
  });
});

describe('deleteAccountSchema', () => {
  it('normalizes the typed confirmation the same way an email is', () => {
    const parsed = deleteAccountSchema.safeParse({ confirmEmail: '  DEMO@DevFetch.site ' });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.confirmEmail).toBe('demo@devfetch.site');
  });

  it('does not require a valid address here, since the server compares it anyway', () => {
    expect(deleteAccountSchema.safeParse({ confirmEmail: 'nonsense' }).success).toBe(true);
  });
});
