import { describe, expect, it } from 'vitest';

import {
  passwordResetErrorMessage,
  signInErrorMessage,
  verificationErrorMessage,
} from './auth-errors';

describe('signInErrorMessage', () => {
  it('names the codes it knows', () => {
    expect(signInErrorMessage('CredentialsSignin')).toBe('Invalid email or password');
    expect(signInErrorMessage('OAuthAccountNotLinked')).toContain('already has an account');
  });

  it('falls back for a code Auth.js has but this map does not', () => {
    expect(signInErrorMessage('SomethingNew')).toBe(
      'Something went wrong signing you in. Please try again.',
    );
  });

  it('returns undefined when there is no code, so no banner renders', () => {
    expect(signInErrorMessage(undefined)).toBeUndefined();
    expect(signInErrorMessage(null)).toBeUndefined();
  });
});

describe('verificationErrorMessage', () => {
  it('distinguishes the outcomes worth acting on', () => {
    expect(verificationErrorMessage('expired')).toContain('expired');
    expect(verificationErrorMessage('invalid')).toContain('most recent one');
    expect(verificationErrorMessage('unknown-user')).toContain('no longer exists');
  });

  it('gives expired and invalid different messages, since only one implies a stale link', () => {
    expect(verificationErrorMessage('expired')).not.toBe(verificationErrorMessage('invalid'));
  });

  it('falls back for an unknown code and returns undefined for none', () => {
    expect(verificationErrorMessage('bogus')).toBe('We could not verify that link. Please try again.');
    expect(verificationErrorMessage(undefined)).toBeUndefined();
  });
});

describe('passwordResetErrorMessage', () => {
  it('names the outcomes it knows', () => {
    expect(passwordResetErrorMessage('expired')).toContain('one hour');
    expect(passwordResetErrorMessage('invalid')).toContain('most recent one');
  });

  it('always returns a message, unlike the other two, because the page always shows one', () => {
    const fallback = 'We could not use that reset link. Please request a new one.';

    expect(passwordResetErrorMessage('bogus')).toBe(fallback);
    expect(passwordResetErrorMessage(undefined)).toBe(fallback);
  });
});
