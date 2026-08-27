import 'server-only';

import { prisma } from '@/lib/prisma';

import { hashPassword } from './password';
import {
  TOKEN_SCOPES,
  deleteScopedToken,
  findScopedToken,
  issueScopedToken,
} from './tokens';

/**
 * Much shorter than a verification link's 24 hours: this one changes a
 * credential rather than confirming an address, and a reset is acted on
 * within minutes or not at all.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Issues a fresh password-reset token for `email` and returns the
 * **plaintext**, which only ever exists in the email that carries it.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  return issueScopedToken(TOKEN_SCOPES.passwordReset, email, TOKEN_TTL_MS);
}

export type PasswordResetTokenStatus = 'valid' | 'invalid' | 'expired';

/**
 * Tests a link **without spending it**, so `/reset-password` can refuse a
 * dead one up front instead of after the user has typed a new password.
 *
 * Deliberately non-destructive on the valid branch: a mail scanner that
 * prefetches the link must not burn it. The password only changes on the
 * `POST` that follows.
 */
export async function checkPasswordResetToken(token: string): Promise<PasswordResetTokenStatus> {
  const lookup = await findScopedToken(TOKEN_SCOPES.passwordReset, token);

  return lookup.status === 'valid' ? 'valid' : lookup.status;
}

export type PasswordResetResult =
  | { status: 'reset' }
  | { status: 'invalid' }
  | { status: 'expired' }
  /** The token was good but the account it names has since been deleted. */
  | { status: 'unknown-user' };

/**
 * Spends a reset token: writes the new password and deletes the row, so a
 * link works exactly once.
 *
 * Takes the plaintext and hashes it here, after the token has proven valid —
 * no caller can pass an unhashed password by mistake, and an invalid token
 * costs no bcrypt.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const lookup = await findScopedToken(TOKEN_SCOPES.passwordReset, token);

  if (lookup.status !== 'valid') {
    return lookup;
  }

  const user = await prisma.user.findUnique({
    where: { email: lookup.email },
    select: { id: true, password: true, emailVerified: true },
  });

  if (!user) {
    // Spent either way: the token names an account that no longer exists, and
    // leaving it would let the same value be retried indefinitely.
    await deleteScopedToken(lookup.tokenHash);

    return { status: 'unknown-user' };
  }

  // No link is ever issued for an account without a password, so this is
  // unreachable through the app. It stays as a floor rather than a race
  // guard: writing a password here would turn a GitHub-only account into one
  // that can also be signed into with credentials, off the back of inbox
  // control alone. Reported as `invalid`, because that is what the token is
  // — it cannot authorize this.
  if (!user.password) {
    await deleteScopedToken(lookup.tokenHash);

    return { status: 'invalid' };
  }

  const passwordHash = await hashPassword(newPassword);

  // Deleting in the same transaction as the update, so a failure cannot leave
  // the password changed with a live link still outstanding, or vice versa.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        // Clicking the link proved control of the inbox, which is exactly
        // what verification asks for. Without this, someone who reset their
        // password while `EMAIL_VERIFICATION` is on would still be refused at
        // sign-in, with no obvious way out. Existing stamps are left alone so
        // the original verification date survives.
        emailVerified: user.emailVerified ?? new Date(),
      },
    }),
    deleteScopedToken(lookup.tokenHash),
  ]);

  return { status: 'reset' };
}
