/**
 * The pure half of keeping `isPro` in step with Stripe.
 *
 * Pure on purpose: no Prisma, no Stripe API call, no `server-only`, so every
 * branch is unit-testable without a database or a network — the call
 * `src/lib/usage-limits.ts` makes for the free tier's ceilings. The half that
 * talks to Stripe is `src/lib/stripe-subscriptions.ts`.
 *
 * **An event says *whose* subscriptions changed, never what they now are.**
 * Stripe does not guarantee delivery order, and a failed delivery is retried
 * for days, so any event's snapshot can be stale by the time it lands: an
 * `.updated` reading `active` can arrive after the `.deleted` that followed it.
 * Reading the state off the event — its type *or* its status — leaves the
 * account on whichever event happened to arrive last. So the webhook takes
 * only the customer from the event and asks Stripe for the current state.
 */
import type Stripe from 'stripe';

/**
 * The subscription statuses that grant Pro.
 *
 * `trialing` counts, which is what would make a trial work with no change here
 * — none is configured today. `past_due`, `unpaid`, `canceled`, `incomplete`
 * and `incomplete_expired` do not: access drops the moment a payment fails,
 * and Stripe's own retries bring it back through a later `.updated`.
 */
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing']);

export function isActiveSubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Stripe fields are `string | Object | null` depending on expansion; we never expand. */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;

  return typeof value === 'string' ? value : value.id;
}

/**
 * The customer whose subscriptions one verified event says have changed, or
 * null when the event is not one we act on.
 *
 * Null covers three cases that all mean "acknowledge and do nothing": an event
 * type we do not subscribe to, a checkout session that was not paying for a
 * subscription, and an event with no customer to resync.
 */
export function subscriptionCustomerFrom(event: Stripe.Event): string | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // A one-off payment is not a subscription, and nothing else in this app
    // opens a Checkout Session — but the endpoint is public, so the mode is
    // checked rather than assumed. A session with no subscription on it has
    // nothing to sync either.
    if (session.mode !== 'subscription' || !idOf(session.subscription)) return null;

    return idOf(session.customer);
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    return idOf((event.data.object as Stripe.Subscription).customer);
  }

  return null;
}

/** The fields `pickLiveSubscription` reads; a full subscription satisfies it. */
export type SubscriptionSummary = Pick<Stripe.Subscription, 'id' | 'status' | 'created'>;

/**
 * The one subscription an account's Pro access follows, or null when none is
 * live.
 *
 * There should only ever be one, since `startCheckout` refuses a second — but
 * two have existed before (the sandbox account was charged twice), so the rule
 * for choosing is spelled out rather than left to list order: the most
 * recently created, then the greater id, so the answer never depends on which
 * order Stripe happened to return them in.
 */
export function pickLiveSubscription<T extends SubscriptionSummary>(
  subscriptions: readonly T[],
): T | null {
  let pick: T | null = null;

  for (const subscription of subscriptions) {
    if (!isActiveSubscriptionStatus(subscription.status)) continue;

    if (
      !pick ||
      subscription.created > pick.created ||
      (subscription.created === pick.created && subscription.id > pick.id)
    ) {
      pick = subscription;
    }
  }

  return pick;
}
