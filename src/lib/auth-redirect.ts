/** Where sign-in sends a user who did not arrive from a protected page. */
export const DEFAULT_SIGNED_IN_PATH = '/dashboard';

/** Where signing out, and every failed authorization, lands. */
export const SIGN_IN_PATH = '/sign-in';

/** Where the "Forgot password?" link goes. */
export const FORGOT_PASSWORD_PATH = '/forgot-password';

/** The target of the link in the password reset email. */
export const RESET_PASSWORD_PATH = '/reset-password';

/**
 * Narrows a `?callbackUrl=` down to a same-origin path. `//evil.example` is
 * rejected alongside absolute URLs: it starts with a slash but browsers read
 * it as protocol-relative, so it would leave the site.
 *
 * Backslashes and control characters are refused before that check, because
 * the URL parser normalizes both away and a later `//` is what is left. `\` is
 * folded to `/` for special schemes, so `/\evil.example` resolves to
 * `http://evil.example/`; tabs and newlines are stripped, so `/\t/evil.example`
 * becomes `//evil.example`. Refusing outright rather than normalizing and
 * re-checking keeps this one predicate instead of a loop that has to be got
 * right twice — and a callback path has no legitimate use for either.
 */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SIGNED_IN_PATH;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_SIGNED_IN_PATH;
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_SIGNED_IN_PATH;

  return value;
}
