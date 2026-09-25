/**
 * The webhook route itself gets no unit test — `coding-standards.md` scopes the
 * suite to server actions and utilities, which is why `/api/uploads` and
 * `/api/auth/register` have none either. Its pure pieces live here instead:
 * which customer an event names, and which live subscription an account
 * follows. The rule they serve — **state comes from Stripe, never from the
 * event** — is pinned end to end in `stripe-subscriptions.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import {
  isActiveSubscriptionStatus,
  pickLiveSubscription,
  subscriptionCustomerFrom,
} from './stripe-events';

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

describe('subscriptionCustomerFrom', () => {
  it('names the customer of a completed subscription checkout', () => {
    expect(subscriptionCustomerFrom(checkoutEvent())).toBe(CUSTOMER);
  });

  it('ignores a checkout that was not paying for a subscription', () => {
    // A one-off payment must never trigger a resync.
    expect(subscriptionCustomerFrom(checkoutEvent({ mode: 'payment' }))).toBeNull();
  });

  it('ignores a checkout with no subscription on it', () => {
    expect(subscriptionCustomerFrom(checkoutEvent({ subscription: null }))).toBeNull();
  });

  it('ignores a checkout with no customer to resync', () => {
    expect(subscriptionCustomerFrom(checkoutEvent({ customer: null }))).toBeNull();
  });

  it('reads an expanded customer object as well as a bare id', () => {
    expect(
      subscriptionCustomerFrom(
        checkoutEvent({ customer: { id: CUSTOMER }, subscription: { id: SUBSCRIPTION } }),
      ),
    ).toBe(CUSTOMER);
  });

  /**
   * Every subscription event names its customer whatever its type or status
   * says — both are a snapshot that can be stale by the time it lands, so the
   * webhook resyncs from Stripe instead of reading either.
   */
  it.each([
    ['created', 'incomplete'],
    ['updated', 'active'],
    ['updated', 'past_due'],
    ['deleted', 'canceled'],
  ] as const)('names the customer of a `%s` event that is %s', (type, status) => {
    expect(subscriptionCustomerFrom(subscriptionEvent(type, status))).toBe(CUSTOMER);
  });

  it('ignores a subscription event with no customer', () => {
    expect(subscriptionCustomerFrom(subscriptionEvent('updated', 'active', { customer: null })))
      .toBeNull();
  });

  it('ignores an event type we do not subscribe to', () => {
    const event = { type: 'invoice.paid', data: { object: {} } } as unknown as Stripe.Event;

    expect(subscriptionCustomerFrom(event)).toBeNull();
  });
});

describe('pickLiveSubscription', () => {
  const sub = (id: string, status: Stripe.Subscription.Status, created: number) => ({
    id,
    status,
    created,
  });

  it('is null when nothing is live, so Pro is revoked', () => {
    expect(
      pickLiveSubscription([sub('sub_a', 'canceled', 1), sub('sub_b', 'past_due', 2)]),
    ).toBeNull();
  });

  it('is null for a customer with no subscriptions at all', () => {
    expect(pickLiveSubscription([])).toBeNull();
  });

  it('picks the live one over a newer one that is not', () => {
    expect(
      pickLiveSubscription([sub('sub_old', 'active', 1), sub('sub_new', 'canceled', 2)])?.id,
    ).toBe('sub_old');
  });

  it('counts a trial as live', () => {
    expect(pickLiveSubscription([sub('sub_trial', 'trialing', 1)])?.id).toBe('sub_trial');
  });

  it('picks the most recently created when two are live, whatever order they arrive in', () => {
    const older = sub('sub_z', 'active', 1);
    const newer = sub('sub_a', 'active', 2);

    expect(pickLiveSubscription([older, newer])?.id).toBe('sub_a');
    expect(pickLiveSubscription([newer, older])?.id).toBe('sub_a');
  });

  it('breaks a tie on creation time by id, so the answer never depends on list order', () => {
    const a = sub('sub_a', 'active', 5);
    const b = sub('sub_b', 'active', 5);

    expect(pickLiveSubscription([a, b])?.id).toBe('sub_b');
    expect(pickLiveSubscription([b, a])?.id).toBe('sub_b');
  });
});
