/**
 * The webhook route itself gets no unit test — `coding-standards.md` scopes the
 * suite to server actions and utilities, which is why `/api/uploads` and
 * `/api/auth/register` have none either. Its one piece of real judgement lives
 * here instead, as a pure function, so the rule it enforces can be pinned:
 * **state comes from `subscription.status`, never from which event arrived.**
 *
 * That is not a stylistic preference. Stripe does not guarantee delivery
 * order, so a handler keyed on `event.type` leaves the account on whichever
 * event happened to land last — and the two events that most often cross are
 * exactly the ones that disagree.
 */
import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import { isActiveSubscriptionStatus, subscriptionIntentFrom } from './stripe-events';

const CUSTOMER = 'cus_123';
const SUBSCRIPTION = 'sub_456';

/** Only the fields the function reads; the real event carries far more. */
function subscriptionEvent(
  type: 'created' | 'updated' | 'deleted',
  status: Stripe.Subscription.Status,
  overrides: { customer?: string | null; id?: string } = {},
): Stripe.Event {
  return {
    type: `customer.subscription.${type}`,
    data: {
      object: {
        id: overrides.id ?? SUBSCRIPTION,
        customer: overrides.customer === undefined ? CUSTOMER : overrides.customer,
        status,
      },
    },
  } as unknown as Stripe.Event;
}

function checkoutEvent(
  overrides: {
    mode?: string;
    customer?: string | { id: string } | null;
    subscription?: string | { id: string } | null;
  } = {},
): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: overrides.mode ?? 'subscription',
        customer: overrides.customer === undefined ? CUSTOMER : overrides.customer,
        subscription: overrides.subscription === undefined ? SUBSCRIPTION : overrides.subscription,
      },
    },
  } as unknown as Stripe.Event;
}

describe('isActiveSubscriptionStatus', () => {
  it('grants Pro while active', () => {
    expect(isActiveSubscriptionStatus('active')).toBe(true);
  });

  it('grants Pro while trialing, so a trial would need no change here', () => {
    expect(isActiveSubscriptionStatus('trialing')).toBe(true);
  });

  it.each(['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired'] as const)(
    'does not grant Pro on %s',
    (status) => {
      expect(isActiveSubscriptionStatus(status)).toBe(false);
    },
  );
});

describe('subscriptionIntentFrom', () => {
  it('activates on a completed subscription checkout', () => {
    expect(subscriptionIntentFrom(checkoutEvent())).toEqual({
      kind: 'activate',
      customerId: CUSTOMER,
      subscriptionId: SUBSCRIPTION,
    });
  });

  it('ignores a checkout that was not paying for a subscription', () => {
    // A one-off payment must never grant Pro.
    expect(subscriptionIntentFrom(checkoutEvent({ mode: 'payment' }))).toBeNull();
  });

  it('ignores a checkout with no subscription to record', () => {
    expect(subscriptionIntentFrom(checkoutEvent({ subscription: null }))).toBeNull();
  });

  it('ignores a checkout with no customer to key the write on', () => {
    expect(subscriptionIntentFrom(checkoutEvent({ customer: null }))).toBeNull();
  });

  it('reads an expanded customer object as well as a bare id', () => {
    expect(
      subscriptionIntentFrom(
        checkoutEvent({ customer: { id: CUSTOMER }, subscription: { id: SUBSCRIPTION } }),
      ),
    ).toMatchObject({ customerId: CUSTOMER, subscriptionId: SUBSCRIPTION });
  });

  /**
   * The heart of it. Each of these pairs an event type with a status that
   * disagrees with it, so anything reading the type rather than the status
   * gets every one of them backwards.
   */
  it('deactivates on an `updated` that is past_due, not just on `deleted`', () => {
    expect(subscriptionIntentFrom(subscriptionEvent('updated', 'past_due'))).toMatchObject({
      kind: 'deactivate',
    });
  });

  it('deactivates on a `created` that is incomplete, so an unpaid start grants nothing', () => {
    expect(subscriptionIntentFrom(subscriptionEvent('created', 'incomplete'))).toMatchObject({
      kind: 'deactivate',
    });
  });

  it('activates on a `deleted` whose status is somehow still active', () => {
    // Contrived on purpose: it is the case that separates reading the status
    // from reading the event name, and the status is what Stripe means.
    expect(subscriptionIntentFrom(subscriptionEvent('deleted', 'active'))).toMatchObject({
      kind: 'activate',
    });
  });

  it('deactivates on a cancelled subscription', () => {
    expect(subscriptionIntentFrom(subscriptionEvent('deleted', 'canceled'))).toEqual({
      kind: 'deactivate',
      customerId: CUSTOMER,
      subscriptionId: SUBSCRIPTION,
    });
  });

  it('carries the subscription id on a deactivation, which the ordering guard matches on', () => {
    expect(subscriptionIntentFrom(subscriptionEvent('deleted', 'canceled', { id: 'sub_old' })))
      .toMatchObject({ subscriptionId: 'sub_old' });
  });

  it('ignores a subscription event with no customer', () => {
    expect(subscriptionIntentFrom(subscriptionEvent('updated', 'active', { customer: null })))
      .toBeNull();
  });

  it('ignores an event type we do not subscribe to', () => {
    const event = { type: 'invoice.paid', data: { object: {} } } as unknown as Stripe.Event;

    expect(subscriptionIntentFrom(event)).toBeNull();
  });
});
