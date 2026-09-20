// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { BillingStatus } from '@/types/billing';

/**
 * Whether the signed-in user is on Pro.
 *
 * Its own keyed query rather than a column added to `getCurrentUser`, which
 * the app shell runs on every request — the reasoning `getEditorPreferences`
 * sets out: `ProfileUser extends CurrentUser`, so widening that query would
 * push the flag into two more types that do not render it.
 *
 * Read from the row and never from the JWT. The token outlives the row it
 * names and a subscription can lapse between one request and the next, so the
 * lookup decides — the same rule `src/lib/db/user.ts` states for the user's
 * own existence. That is why there is no `jwt` callback putting `isPro` in the
 * session, and the consequence is a feature: a plain page reload after
 * checkout picks up the new status, with no sign-out.
 *
 * `cache`d, so however many gates ask during one request, it is one query.
 */
export const isProUser = cache(async (): Promise<boolean> => {
  const session = await auth();

  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  return user?.isPro ?? false;
});

/**
 * The signed-in user's billing record, or null when nobody is signed in — or
 * when the session names a row that is gone, since the JWT outlives it.
 *
 * Separate from `isProUser` rather than the one query serving both: the gates
 * ask only whether the account is Pro and run on ordinary writes, while this
 * is read by the settings page and by checkout, which need the Stripe ids too.
 */
export const getBillingStatus = cache(async (): Promise<BillingStatus | null> => {
  const session = await auth();

  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });

  return user;
});

/**
 * Records the Stripe customer against the user.
 *
 * Separate from the webhook's write because it runs inside the checkout
 * request, before any event arrives — which is what lets the webhook resolve
 * a user by `stripeCustomerId` rather than trusting metadata.
 */
export async function linkStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });
}

/**
 * Applies a subscription's state to the user it belongs to, reporting whether
 * a row matched.
 *
 * Keyed on `stripeCustomerId`, which is `@unique`, so this can match at most
 * one row — and on the customer rather than the user id because the webhook
 * knows Stripe's identifiers and nothing else.
 *
 * `updateMany` rather than `update` so an unknown customer is a count of `0`
 * instead of a thrown P2025. A webhook for a customer we do not know about has
 * to be logged and acknowledged, never retried forever.
 *
 * **Absolute, never relative.** Every value here is set outright, so applying
 * the same event twice changes nothing the second time — that idempotence is
 * exactly what makes the webhook safe to retry with no dedupe table. Do not
 * "fix" this into a toggle or anything that reads the current value first.
 */
export async function applySubscriptionState(
  stripeCustomerId: string,
  subscriptionId: string | null,
  isActive: boolean,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { stripeCustomerId },
    data: {
      isPro: isActive,
      stripeSubscriptionId: subscriptionId,
    },
  });

  return result.count > 0;
}
