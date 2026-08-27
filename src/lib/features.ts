/**
 * Operational switches, read from the environment rather than the database:
 * these are deployment decisions, not properties of any row — the same call
 * `src/lib/pro.ts` makes for which item types are Pro.
 */

/** The one value that turns email verification off. Everything else leaves it on. */
const DISABLED = 'off';

/**
 * Whether registration issues a verification link and credentials sign-in
 * requires one.
 *
 * Off is the explicit choice, so an unset, empty or misspelled
 * `EMAIL_VERIFICATION` keeps the gate on and a deploy that forgets the
 * variable fails secure. Read at call time rather than at module scope: a
 * value captured on import would be the one present during `next build`.
 *
 * Turn it off while Resend has no verified domain — until one is added at
 * resend.com/domains, every recipient but the Resend account's own address is
 * rejected, so verification emails cannot reach anyone else and their accounts
 * would be unusable.
 */
export function isEmailVerificationEnabled(): boolean {
  return process.env.EMAIL_VERIFICATION?.trim().toLowerCase() !== DISABLED;
}
