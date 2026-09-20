// Fails the build if a client component imports this. The secret key must
// never be reachable from the browser bundle.
import 'server-only';

import Stripe from 'stripe';

import type { BillingInterval } from '@/types/billing';

/**
 * The Stripe client, built on first use and reused for the life of the
 * process.
 *
 * Lazy rather than at module scope, for the reason `src/lib/rate-limit.ts`
 * builds its limiters lazily: the key is read at call time, so `next build`
 * cannot depend on the build machine holding the secret. A module-level
 * `new Stripe(process.env.STRIPE_SECRET_KEY!)` would break any build without
 * it — and `src/lib/email/client.ts` already learned the adjacent lesson,
 * where `new Resend(undefined)` throws at construction.
 */
let client: Stripe | undefined;

/**
 * The Stripe client, or a throw when the key is missing.
 *
 * Throwing is right here where `src/lib/rate-limit.ts` fails open: an
 * unconfigured rate limiter means requests go unlimited, while an
 * unconfigured Stripe client means there is no API to call at all, and
 * pretending otherwise would charge nobody while reporting success.
 *
 * `apiVersion` is deliberately omitted. Unset, the SDK sends the version its
 * own release was generated against — the one its TypeScript types describe —
 * so pinning a different literal here would make the types lie.
 */
export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  // The SDK retries once by default. Two, because a checkout session that
  // fails on a blip strands the user mid-upgrade.
  client = new Stripe(key, { maxNetworkRetries: 2 });

  return client;
}

/**
 * The price id for one billing interval, read at call time for the same
 * reason the key is.
 *
 * Two prices on one product rather than two products, which is what lets the
 * billing portal offer a switch between them.
 */
export function getPriceId(interval: BillingInterval): string {
  const id = (
    interval === 'yearly'
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY
  )?.trim();

  if (!id) {
    throw new Error(`Stripe price id for ${interval} is not set`);
  }

  return id;
}
