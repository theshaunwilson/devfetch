/**
 * The `code` carried by the error `authorize` throws for an account whose
 * address is not verified. Kept here, next to its message, so the sign-in
 * action can match on it without importing the error class.
 */
export const EMAIL_NOT_VERIFIED_CODE = 'email_not_verified';

export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Verify your email before signing in. Check your inbox for the link we sent you.';

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

/**
 * Outcomes of `/verify-email`, which redirects here with `?verifyError=`.
 * Each names something the user can act on: only `expired` and `invalid` are
 * worth a resend, so the messages differ rather than sharing one failure.
 */
const VERIFICATION_ERRORS: Record<string, string> = {
  // Superseded links land here too: issuing a new token deletes the previous
  // one, so the most common cause is a newer email already in the inbox.
  invalid:
    'That verification link is no longer valid. If you asked for more than one email, open the most recent one — otherwise sign in to send yourself a new link.',
  expired: 'That verification link has expired. Sign in to send yourself a new one.',
  'unknown-user': 'That account no longer exists. Create a new one to continue.',
};

export function verificationErrorMessage(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined;

  return VERIFICATION_ERRORS[code] ?? 'We could not verify that link. Please try again.';
}
