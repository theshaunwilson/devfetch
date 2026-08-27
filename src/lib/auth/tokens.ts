import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';

import { type TokenScope, scopedIdentifier } from './token-scopes';

/**
 * Single-use, emailed tokens. Email verification and password reset share one
 * `VerificationToken` table, told apart by the scope in `identifier` — see
 * `./token-scopes`. This matters: tokens are looked up by hash alone, so
 * without it a link issued for one purpose would satisfy the other — an
 * email-verification link would work as a password-reset credential. Every
 * read below requires the scope prefix it expects, so a token minted under
 * one scope can never satisfy another, whatever the address itself contains.
 */
export { TOKEN_SCOPES } from './token-scopes';
export type { TokenScope } from './token-scopes';

/**
 * The link is a bearer credential: whoever holds it can act on that account.
 * Only the digest is stored, so a leaked database backup does not hand over
 * working links — the same reason `User.password` is never stored in the
 * clear. A plain SHA-256 is enough here, unlike for a password: the input is
 * 256 random bits, so there is no dictionary to run against it.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 256 bits of entropy, so the stored digest cannot be brute-forced. */
const TOKEN_BYTES = 32;

/**
 * Issues a token for `email` within `scope` and returns the **plaintext**,
 * which only ever exists in the email that carries it.
 *
 * Any token already outstanding for that address **in the same scope** is
 * dropped first, so a resend invalidates the previous link rather than
 * leaving several live at once. A pending token in another scope survives:
 * asking for a password reset must not quietly kill a verification link.
 */
export async function issueScopedToken(
  scope: TokenScope,
  email: string,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  // Two sweeps in one statement. Dropping this scope's outstanding token for
  // the address means a reissue invalidates the previous link; dropping every
  // expired row keeps the table bounded, since `VerificationToken` has no
  // foreign key to `User` — it is keyed on the identifier string — so a
  // deleted account orphans its token, and a link nobody ever clicks would
  // otherwise sit here for good. The `expires` index carries the second half.
  await prisma.verificationToken.deleteMany({
    where: {
      OR: [{ identifier: scopedIdentifier(scope, email) }, { expires: { lte: new Date() } }],
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: scopedIdentifier(scope, email),
      token: hashToken(token),
      expires: new Date(Date.now() + ttlMs),
    },
  });

  return token;
}

export type ScopedTokenLookup =
  | { status: 'valid'; email: string; tokenHash: string }
  /** No such token in this scope — never issued, already spent, or altered. */
  | { status: 'invalid' }
  | { status: 'expired' };

/**
 * Looks a token up **without spending it**, so a page can tell the holder
 * their link is dead before asking them to fill anything in. An expired row
 * is deleted on the way through: it can never become usable again, and
 * leaving it would let the same value be retried indefinitely.
 *
 * The caller spends a valid token itself, in the same transaction as whatever
 * the token authorizes — see `deleteScopedToken`.
 */
export async function findScopedToken(
  scope: TokenScope,
  token: string,
): Promise<ScopedTokenLookup> {
  const tokenHash = hashToken(token);

  // Looked up by token alone, so the `@@unique([identifier, token])` index
  // cannot serve it — `identifier` leads. The table only ever holds pending
  // tokens and rows are deleted on use, so it stays small enough that the
  // scan costs nothing; an index on `token` would need a migration.
  const record = await prisma.verificationToken.findFirst({ where: { token: tokenHash } });

  const prefix = `${scope}:`;

  // A token from another scope is no more valid here than one that never
  // existed, and must not be reported differently.
  if (!record || !record.identifier.startsWith(prefix)) {
    return { status: 'invalid' };
  }

  if (record.expires.getTime() <= Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });

    return { status: 'expired' };
  }

  return { status: 'valid', email: record.identifier.slice(prefix.length), tokenHash };
}

/**
 * The delete that spends a token, returned unawaited so a caller can hand it
 * to `prisma.$transaction` alongside the write it authorizes — neither half
 * may land without the other.
 */
export function deleteScopedToken(tokenHash: string) {
  return prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
}
