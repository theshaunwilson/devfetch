import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';

/**
 * How long a verification link stays usable. Long enough to survive an inbox
 * left until the next day, short enough that an old forwarded email is dead.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 256 bits of entropy, so the stored digest cannot be brute-forced. */
const TOKEN_BYTES = 32;

/**
 * The link is a bearer credential: whoever holds it can verify that account.
 * Only the digest is stored, so a leaked database backup does not hand over
 * working links — the same reason `User.password` is never stored in the
 * clear. A plain SHA-256 is enough here, unlike for a password: the input is
 * 256 random bits, so there is no dictionary to run against it.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a fresh verification token for `email` and returns the **plaintext**,
 * which only ever exists in the email that carries it.
 *
 * Any token already outstanding for the address is dropped first, so a resend
 * invalidates the previous link rather than leaving several live at once.
 */
export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  // Two sweeps in one statement. Dropping this address's outstanding token
  // means a resend invalidates the previous link rather than leaving several
  // live at once; dropping every expired row keeps the table bounded, since
  // `VerificationToken` has no foreign key to `User` — it is keyed on the
  // email string — so a deleted account orphans its token, and a link nobody
  // ever clicks would otherwise sit here for good. The `expires` index
  // carries the second half.
  await prisma.verificationToken.deleteMany({
    where: { OR: [{ identifier: email }, { expires: { lte: new Date() } }] },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return token;
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
  // Looked up by token alone, so the `@@unique([identifier, token])` index
  // cannot serve it — `identifier` leads. The table only ever holds pending
  // verifications and rows are deleted on use, so it stays small enough that
  // the scan costs nothing; an index on `token` would need a migration.
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashToken(token) },
  });

  if (!record) {
    return { status: 'invalid' };
  }

  if (record.expires.getTime() <= Date.now()) {
    // Spent either way: an expired link must not become usable again, and
    // leaving it would let the same value be retried indefinitely.
    await prisma.verificationToken.deleteMany({ where: { token: record.token } });

    return { status: 'expired' };
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true },
  });

  if (!user) {
    await prisma.verificationToken.deleteMany({ where: { token: record.token } });

    return { status: 'unknown-user' };
  }

  // Deleting in the same transaction as the update, so a failure cannot leave
  // the account verified with a live link still outstanding, or vice versa.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { token: record.token } }),
  ]);

  return { status: 'verified', email: record.identifier };
}
