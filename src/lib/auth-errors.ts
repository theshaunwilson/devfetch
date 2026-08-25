/**
 * Auth.js redirects to `pages.error` with `?error=<code>` for failures it
 * raises outside a form action — the OAuth handshake, mostly. Codes it does
 * not name here fall through to the generic message.
 */
const SIGN_IN_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email already has an account. Sign in the way you did originally, then link GitHub.',
  AccessDenied: 'You do not have access to this application.',
  Configuration: 'Sign-in is not configured correctly. Please try again later.',
  Verification: 'That sign-in link is no longer valid.',
  CredentialsSignin: 'Invalid email or password',
};

export function signInErrorMessage(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined;

  return SIGN_IN_ERRORS[code] ?? 'Something went wrong signing you in. Please try again.';
}
