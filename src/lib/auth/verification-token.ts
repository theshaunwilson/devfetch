import 'server-only';

import { prisma } from '@/lib/prisma';

import {
  TOKEN_SCOPES,
  deleteScopedToken,
  findScopedToken,
  issueScopedToken,
} from './tokens';

/**
 * How long a verification link stays usable. Long enough to survive an inbox
 * left until the next day, short enough that an old forwarded email is dead.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Issues a fresh verification token for `email` and returns the **plaintext**,
 * which only ever exists in the email that carries it.
 */
export async function createEmailVerificationToken(email: string): Promise<string> {
  return issueScopedToken(TOKEN_SCOPES.emailVerification, email, TOKEN_TTL_MS);
}

export type VerificationResult =
  | { status: 'verified'; email: string }
  /** No such token — never issued, already spent, or altered in transit. */
  | { status: 'invalid' }
  | { status: 'expired' }
  /** The token was good but the account it names has since been deleted. */
  | { status: 'unknown-user' };

/**
 * Spends a verification token: marks the address verified and deletes the row,
 * so a link works exactly once.
 */
export async function consumeEmailVerificationToken(token: string): Promise<VerificationResult> {
  const lookup = await findScopedToken(TOKEN_SCOPES.emailVerification, token);

  if (lookup.status !== 'valid') {
    return lookup;
  }

  const user = await prisma.user.findUnique({
    where: { email: lookup.email },
    select: { id: true },
  });

  if (!user) {
    // Spent either way: the token names an account that no longer exists, and
    // leaving it would let the same value be retried indefinitely.
    await deleteScopedToken(lookup.tokenHash);

    return { status: 'unknown-user' };
  }

  // Deleting in the same transaction as the update, so a failure cannot leave
  // the account verified with a live link still outstanding, or vice versa.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
    deleteScopedToken(lookup.tokenHash),
  ]);

  return { status: 'verified', email: lookup.email };
}
