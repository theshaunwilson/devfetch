/**
 * What an emailed token is for.
 *
 * Email verification and password reset share one `VerificationToken` table —
 * the schema has no column saying which is which, and adding one would need a
 * migration. The scope is therefore carried in `identifier`, which becomes
 * `"<scope>:<email>"` rather than the bare address.
 *
 * Kept in its own module, free of `server-only` and of Prisma, so that
 * `scripts/` can build the same identifiers the app writes. A script that
 * guessed at the format instead would go silently stale the day a scope is
 * added — which is exactly how `db:prune-users` started orphaning rows.
 */
export const TOKEN_SCOPES = {
  emailVerification: 'email-verification',
  passwordReset: 'password-reset',
} as const;

export type TokenScope = (typeof TOKEN_SCOPES)[keyof typeof TOKEN_SCOPES];

export function scopedIdentifier(scope: TokenScope, email: string): string {
  return `${scope}:${email}`;
}

/** Every identifier an address could hold a token under. */
export function allScopedIdentifiers(email: string): string[] {
  return Object.values(TOKEN_SCOPES).map((scope) => scopedIdentifier(scope, email));
}
