import { afterEach, describe, expect, it, vi } from 'vitest';

import { isEmailVerificationEnabled } from './features';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isEmailVerificationEnabled', () => {
  it('is off only for the literal "off"', () => {
    vi.stubEnv('EMAIL_VERIFICATION', 'off');
    expect(isEmailVerificationEnabled()).toBe(false);
  });

  it('tolerates case and padding around "off"', () => {
    for (const value of ['OFF', ' off ', 'Off', '\toff\n']) {
      vi.stubEnv('EMAIL_VERIFICATION', value);
      expect(isEmailVerificationEnabled()).toBe(false);
    }
  });

  it('stays ON when the variable is unset, so a deploy that forgets it fails secure', () => {
    vi.stubEnv('EMAIL_VERIFICATION', undefined);
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it('stays ON for a typo, an empty string or any other value', () => {
    // "of" is the misspelling that matters: it must not read as "off".
    for (const value of ['of', '', 'false', '0', 'no', 'disabled', 'on']) {
      vi.stubEnv('EMAIL_VERIFICATION', value);
      expect(isEmailVerificationEnabled()).toBe(true);
    }
  });

  it('reads the variable at call time, not at import', () => {
    // The reason the module exports a function rather than a constant: a value
    // captured on import would be the one present during `next build`.
    vi.stubEnv('EMAIL_VERIFICATION', 'off');
    expect(isEmailVerificationEnabled()).toBe(false);

    vi.stubEnv('EMAIL_VERIFICATION', 'on');
    expect(isEmailVerificationEnabled()).toBe(true);
  });
});
