/**
 * What a Stripe webhook event means for an account's Pro access.
 *
 * Pure on purpose: no Prisma, no Stripe API call, no `server-only`. The event
 * comes from the caller already verified, so every branch is unit-testable
 * without a database or a network — the call `src/lib/usage-limits.ts` makes
 * for the free tier's ceilings.
 *
 * This is also where the webhook's one load-bearing rule lives, so it can be
 * pinned by a test rather than only stated in a route: **state is derived from
 * `subscription.status`, never from which event arrived.** Stripe does not
 * guarantee delivery order, so an `.updated` can land after the `.deleted` that
 * followed it, and a handler keyed on `event.type` would then leave the account
 * on whichever event happened to arrive last.
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

/**
 * What one event asks us to write, or null for an event that asks for nothing.
 *
 * Both arms carry the subscription id. The deactivating one needs it for the
 * ordering guard — the write matches on it, so a stale `deleted` for a
 * subscription the account has already replaced matches no row instead of
 * revoking the newer one.
 */
export type SubscriptionIntent =
  | { kind: 'activate'; customerId: string; subscriptionId: string }
  | { kind: 'deactivate'; customerId: string; subscriptionId: string };

/** Stripe fields are `string | Object | null` depending on expansion; we never expand. */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;

  return typeof value === 'string' ? value : value.id;
}

/**
 * Reads one verified event into the state it asks for, or null when the event
 * is not one we act on.
 *
 * Null covers three cases that all mean "acknowledge and do nothing": an event
 * type we do not subscribe to, a checkout session that was not paying for a
 * subscription, and an event whose customer or subscription id is missing —
 * there is nothing to key a write on, so there is nothing to write.
 */
export function subscriptionIntentFrom(event: Stripe.Event): SubscriptionIntent | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // A one-off payment is not a subscription, and nothing else in this app
    // opens a Checkout Session — but the endpoint is public, so the mode is
    // checked rather than assumed.
    if (session.mode !== 'subscription') return null;

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);

    if (!customerId || !subscriptionId) return null;

    // Deliberately not conditioned on `payment_status`. Since the Basil API
    // version, the subscription is created only after payment completes, so a
    // session that has one has been paid for; the subscription's own events
    // are what correct it afterwards if that ever stops being true.
    return { kind: 'activate', customerId, subscriptionId };
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = idOf(subscription.customer);

    if (!customerId) return null;

    // The status decides, not the event type. `.deleted` arrives with a
    // `canceled` status and `.created` can arrive `incomplete`, so reading the
    // type instead would get both of those wrong.
    return {
      kind: isActiveSubscriptionStatus(subscription.status) ? 'activate' : 'deactivate',
      customerId,
      subscriptionId: subscription.id,
    };
  }

  return null;
}
