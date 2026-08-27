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
 */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SIGNED_IN_PATH;
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_SIGNED_IN_PATH;

  return value;
}
