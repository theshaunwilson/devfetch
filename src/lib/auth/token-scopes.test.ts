import { describe, expect, it } from 'vitest';

import { TOKEN_SCOPES, allScopedIdentifiers, scopedIdentifier } from './token-scopes';

describe('scopedIdentifier', () => {
  it('prefixes the address with the scope', () => {
    expect(scopedIdentifier(TOKEN_SCOPES.emailVerification, 'demo@devfetch.io')).toBe(
      'email-verification:demo@devfetch.io',
    );
    expect(scopedIdentifier(TOKEN_SCOPES.passwordReset, 'demo@devfetch.io')).toBe(
      'password-reset:demo@devfetch.io',
    );
  });

  it('gives the two scopes different identifiers for one address', () => {
    // The property the whole scheme rests on: a verification link must not
    // work as a password-reset credential, and lookups match on this string.
    const email = 'demo@devfetch.io';

    expect(scopedIdentifier(TOKEN_SCOPES.emailVerification, email)).not.toBe(
      scopedIdentifier(TOKEN_SCOPES.passwordReset, email),
    );
  });
});

describe('allScopedIdentifiers', () => {
  it('covers every scope, so a cleanup cannot orphan rows under one of them', () => {
    const identifiers = allScopedIdentifiers('demo@devfetch.io');

    expect(identifiers).toHaveLength(Object.keys(TOKEN_SCOPES).length);
    expect(identifiers).toEqual(
      expect.arrayContaining([
        'email-verification:demo@devfetch.io',
        'password-reset:demo@devfetch.io',
      ]),
    );
  });

  it('stays in step with TOKEN_SCOPES rather than a hardcoded list', () => {
    const identifiers = allScopedIdentifiers('a@b.io');

    for (const scope of Object.values(TOKEN_SCOPES)) {
      expect(identifiers).toContain(`${scope}:a@b.io`);
    }
  });
});
