import 'server-only';

import type Stripe from 'stripe';

import { applySubscriptionState } from '@/lib/db/billing';
import { getStripe } from '@/lib/stripe';
import { isActiveSubscriptionStatus, pickLiveSubscription } from '@/lib/stripe-events';

/**
 * What Stripe currently says about one customer's subscriptions.
 *
 * `isPro` is a cache the webhook fills; Stripe is the authority. Every question
 * that decides money or access — is this account paying, may it open another
 * checkout, what must be cancelled before it is deleted — asks Stripe through
 * here, so all three read the same list through the same predicate.
 */

/**
 * The customer's live subscriptions — the ones `isActiveSubscriptionStatus`
 * says grant Pro.
 *
 * `status: 'all'` and filtered here, rather than `status: 'active'` passed to
 * the API, so `trialing` is counted exactly as the predicate counts it. 100 is
 * Stripe's page ceiling, far beyond the one subscription `startCheckout`
 * allows.
 */
export async function listLiveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const subscriptions = await getStripe().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  return subscriptions.data.filter((subscription) =>
    isActiveSubscriptionStatus(subscription.status),
  );
}

/**
 * Writes the customer's current subscription state to their row, reporting
 * whether a row matched.
 *
 * What the webhook calls for every event it acts on. The state is fetched, not
 * read off the event, which is what makes delivery order irrelevant: a stale
 * `active` landing after a cancellation re-derives "nothing live" and grants
 * nothing, and a late event for a replaced subscription cannot overwrite the
 * id of the newer one. Absolute values, so a retry is a no-op.
 *
 * A Stripe failure throws, and the webhook answers 500 so Stripe retries.
 */
export async function syncSubscriptionState(customerId: string): Promise<boolean> {
  const live = pickLiveSubscription(await listLiveSubscriptions(customerId));

  return applySubscriptionState(customerId, live?.id ?? null, live !== null);
}

/**
 * Cancels every live subscription the customer holds, immediately and with no
 * proration refund.
 *
 * For account deletion: once the row is gone nobody can reach Manage billing,
 * so a subscription left running would keep charging a card for an account
 * that no longer exists. Throws on any failure, and the caller must not delete
 * the account when it does.
 */
export async function cancelLiveSubscriptions(customerId: string): Promise<number> {
  const live = await listLiveSubscriptions(customerId);
  const stripe = getStripe();

  for (const subscription of live) {
    await stripe.subscriptions.cancel(subscription.id);
  }

  return live.length;
}
