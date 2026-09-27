import 'server-only';

import { Resend } from 'resend';

/**
 * Resend rejects any recipient other than the address on the account until a
 * domain is verified, so this stays the testing sender. Swapping to
 * `noreply@devfetch.site` once the domain is verified is an env change only.
 */
const DEFAULT_FROM = 'DevFetch <onboarding@resend.dev>';

export const EMAIL_FROM = process.env.EMAIL_FROM ?? DEFAULT_FROM;

let client: Resend | null = null;

/**
 * Built on first use rather than at module scope: the constructor throws when
 * `RESEND_API_KEY` is unset, and route modules are imported during
 * `next build`, so a top-level `new Resend(...)` would break any build
 * without the key in the environment.
 */
export function getResend(): Resend {
  client ??= new Resend(process.env.RESEND_API_KEY);

  return client;
}
