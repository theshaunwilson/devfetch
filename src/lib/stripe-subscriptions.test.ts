/**
 * The half of billing that asks Stripe what is true, rather than believing an
 * event.
 *
 * What is pinned here is the webhook's order-independence: the write follows
 * Stripe's *current* subscriptions, so a stale `active` landing after a
 * cancellation grants nothing, and a late event for a replaced subscription
 * cannot overwrite the id of the newer one. And, for account deletion, that
 * every live subscription is cancelled and a failure is never swallowed.
 *
 * Mocked at the module boundary — `@/lib/stripe` and `@/lib/db/billing` — with
 * the status predicate and the pick left real, so these run the rules
 * production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('@/lib/db/billing', () => ({ applySubscriptionState: vi.fn() }));

const { getStripe } = await import('@/lib/stripe');
const { applySubscriptionState } = await import('@/lib/db/billing');
const { cancelLiveSubscriptions, listLiveSubscriptions, syncSubscriptionState } = await import(
  './stripe-subscriptions'
);

const stripe = vi.mocked(getStripe);
const applyState = vi.mocked(applySubscriptionState);

const CUSTOMER = 'cus_123';

const listSubscriptions = vi.fn();
const cancelSubscription = vi.fn();

const stripeClient = {
  subscriptions: { list: listSubscriptions, cancel: cancelSubscription },
};

/** What Stripe currently holds for the customer; only the fields read here. */
function stripeHolds(...subscriptions: { id: string; status: string; created: number }[]): void {
  listSubscriptions.mockResolvedValue({ data: subscriptions });
}

beforeEach(() => {
  vi.clearAllMocks();
  stripe.mockReturnValue(stripeClient as unknown as ReturnType<typeof getStripe>);
  stripeHolds();
  applyState.mockResolvedValue(true);
  cancelSubscription.mockResolvedValue({});
});

describe('listLiveSubscriptions', () => {
  it('asks for every status and filters with our own predicate, so a trial counts', async () => {
    stripeHolds(
      { id: 'sub_a', status: 'active', created: 1 },
      { id: 'sub_t', status: 'trialing', created: 2 },
      { id: 'sub_c', status: 'canceled', created: 3 },
    );

    const live = await listLiveSubscriptions(CUSTOMER);

    expect(listSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER, status: 'all' }),
    );
    expect(live.map((subscription) => subscription.id)).toEqual(['sub_a', 'sub_t']);
  });
});

describe('syncSubscriptionState', () => {
  it('grants Pro with the live subscription’s id', async () => {
    stripeHolds({ id: 'sub_live', status: 'active', created: 1 });

    await syncSubscriptionState(CUSTOMER);

    expect(applyState).toHaveBeenCalledWith(CUSTOMER, 'sub_live', true);
  });

  /**
   * The stale-event case. A retried `updated: active` landing after the
   * cancellation used to re-grant Pro for good, since no later event for that
   * subscription would ever clear it. The event is no longer consulted at all:
   * Stripe says the subscription is cancelled, so Pro is revoked.
   */
  it('revokes Pro when Stripe says nothing is live, whatever the event said', async () => {
    stripeHolds({ id: 'sub_old', status: 'canceled', created: 1 });

    await syncSubscriptionState(CUSTOMER);

    expect(applyState).toHaveBeenCalledWith(CUSTOMER, null, false);
  });

  it('keeps the newer subscription when a replaced one is still listed', async () => {
    // Cancelled A, subscribed B. A late event for A resyncs to B, rather than
    // writing A's id over it and leaving B's own later cancellation unmatched.
    stripeHolds(
      { id: 'sub_a', status: 'canceled', created: 1 },
      { id: 'sub_b', status: 'active', created: 2 },
    );

    await syncSubscriptionState(CUSTOMER);

    expect(applyState).toHaveBeenCalledWith(CUSTOMER, 'sub_b', true);
  });

  it('follows the newest when two are live, not whichever Stripe listed first', async () => {
    // Two live subscriptions should never exist, but the sandbox account held
    // exactly that once. The recorded id has to be deterministic.
    stripeHolds(
      { id: 'sub_older', status: 'active', created: 1 },
      { id: 'sub_newer', status: 'active', created: 2 },
    );

    await syncSubscriptionState(CUSTOMER);

    expect(applyState).toHaveBeenCalledWith(CUSTOMER, 'sub_newer', true);
  });

  it('reports whether a row matched, so the route can log an unknown customer', async () => {
    applyState.mockResolvedValue(false);

    await expect(syncSubscriptionState(CUSTOMER)).resolves.toBe(false);
  });

  it('throws when Stripe cannot be reached, writing nothing, so the webhook retries', async () => {
    listSubscriptions.mockRejectedValue(new Error('Stripe unreachable'));

    await expect(syncSubscriptionState(CUSTOMER)).rejects.toThrow('Stripe unreachable');
    expect(applyState).not.toHaveBeenCalled();
  });
});

describe('cancelLiveSubscriptions', () => {
  it('cancels every live subscription and leaves the rest alone', async () => {
    stripeHolds(
      { id: 'sub_a', status: 'active', created: 1 },
      { id: 'sub_b', status: 'trialing', created: 2 },
      { id: 'sub_c', status: 'canceled', created: 3 },
    );

    await expect(cancelLiveSubscriptions(CUSTOMER)).resolves.toBe(2);
    expect(cancelSubscription.mock.calls.map(([id]) => id)).toEqual(['sub_a', 'sub_b']);
  });

  it('makes no cancel call when nothing is live', async () => {
    await expect(cancelLiveSubscriptions(CUSTOMER)).resolves.toBe(0);
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it('throws when a cancel fails, so the account is not deleted with billing still running', async () => {
    stripeHolds({ id: 'sub_a', status: 'active', created: 1 });
    cancelSubscription.mockRejectedValue(new Error('card_declined'));

    await expect(cancelLiveSubscriptions(CUSTOMER)).rejects.toThrow('card_declined');
  });
});
