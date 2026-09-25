/**
 * The billing readers and the subscription write.
 *
 * Three properties are worth pinning. `isProUser` must read the row rather
 * than the session, because the JWT outlives the row it names and a
 * subscription can lapse between one request and the next. The write must be
 * keyed on `stripeCustomerId` and not on the user id, since the webhook knows
 * Stripe's identifiers and nothing else — keying it on `id` would hand a
 * Stripe customer id to a column of cuids and silently match nobody. And it
 * must report a count of zero rather than throwing, so a webhook for an
 * unknown customer can be logged and acknowledged instead of retried forever.
 *
 * Same pattern as `src/lib/db/user.ts`'s tests: mock `@/auth` and
 * `@/lib/prisma` at the module boundary, so no database is involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));

const { auth } = await import('@/auth');
const { prisma } = await import('@/lib/prisma');
const {
  applySubscriptionState,
  getBillingStatus,
  isProUser,
  linkStripeCustomer,
} = await import('./billing');

const session = vi.mocked(auth);

/**
 * The selected shape, not the whole model. `vi.mocked` on an overloaded
 * Prisma method resolves to the full-row return type and rejects a selected
 * one — a failure `npx tsc --noEmit` catches while lint and a green suite both
 * pass, which this project has hit three times.
 */
interface BillingRow {
  isPro: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

const findUnique = prisma.user.findUnique as unknown as ReturnType<
  typeof vi.fn<(args: unknown) => Promise<BillingRow | null>>
>;
const updateMany = prisma.user.updateMany as unknown as ReturnType<
  typeof vi.fn<(args: unknown) => Promise<{ count: number }>>
>;

const USER_ID = 'user_1';
const CUSTOMER_ID = 'cus_123';
const SUBSCRIPTION_ID = 'sub_123';

function signedIn() {
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
}

function signedOut() {
  session.mockResolvedValue(null as unknown as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  findUnique.mockResolvedValue({
    isPro: true,
    stripeCustomerId: CUSTOMER_ID,
    stripeSubscriptionId: SUBSCRIPTION_ID,
  });
  updateMany.mockResolvedValue({ count: 1 });
});

describe('isProUser', () => {
  it('reads the flag off the row named by the session, selecting only that column', async () => {
    await expect(isProUser()).resolves.toBe(true);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { isPro: true },
    });
  });

  it('is false for a free account', async () => {
    findUnique.mockResolvedValue({ isPro: false });

    await expect(isProUser()).resolves.toBe(false);
  });

  // Nobody signed in cannot be Pro, and asking the database would be a query
  // issued on behalf of no one.
  it('is false with nobody signed in, and issues no query', async () => {
    signedOut();

    await expect(isProUser()).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  /**
   * The reason the flag is read from the row rather than carried in the JWT:
   * a session token outlives the row it names. Trusting the token here would
   * keep granting Pro to a deleted account until it expired.
   */
  it('is false when the session names a row that is gone', async () => {
    findUnique.mockResolvedValue(null);

    await expect(isProUser()).resolves.toBe(false);
  });
});

describe('getBillingStatus', () => {
  it('returns the record for the signed-in user', async () => {
    await expect(getBillingStatus()).resolves.toEqual({
      isPro: true,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { isPro: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });
  });

  it('is null with nobody signed in, and issues no query', async () => {
    signedOut();

    await expect(getBillingStatus()).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('is null when the session names a row that is gone', async () => {
    findUnique.mockResolvedValue(null);

    await expect(getBillingStatus()).resolves.toBeNull();
  });

  // A Pro account with no customer — granted by hand, never through checkout —
  // has nothing for the billing portal to manage. The settings card derives
  // that from the null id, so the null has to survive the read.
  it('reports a null customer for an account that has never checked out', async () => {
    findUnique.mockResolvedValue({
      isPro: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });

    await expect(getBillingStatus()).resolves.toEqual({
      isPro: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
  });
});

describe('linkStripeCustomer', () => {
  it('writes the customer only while the row has none', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(linkStripeCustomer(USER_ID, CUSTOMER_ID)).resolves.toBe(CUSTOMER_ID);

    // The `null` in the filter is the whole race fix: an unconditional write
    // would let the second of two concurrent checkouts overwrite the first.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, stripeCustomerId: null },
      data: { stripeCustomerId: CUSTOMER_ID },
    });
  });

  it('returns the customer already linked when another request got there first', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ isPro: false, stripeCustomerId: 'cus_winner' });

    await expect(linkStripeCustomer(USER_ID, CUSTOMER_ID)).resolves.toBe('cus_winner');
  });

  it('throws when the row has gone, since there is no customer to use', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);

    await expect(linkStripeCustomer(USER_ID, CUSTOMER_ID)).rejects.toThrow();
  });

  // It runs inside the checkout request, which has already resolved the user —
  // so the owner is an argument, and nothing here reads the session.
  it('does not consult the session', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await linkStripeCustomer(USER_ID, CUSTOMER_ID);

    expect(session).not.toHaveBeenCalled();
  });

  it('writes nothing but the customer id', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await linkStripeCustomer(USER_ID, CUSTOMER_ID);

    const [args] = updateMany.mock.calls[0] as [{ data: Record<string, unknown> }];

    expect(Object.keys(args.data)).toEqual(['stripeCustomerId']);
  });
});

describe('applySubscriptionState', () => {
  /**
   * The webhook resolves a user by Stripe's customer id, which is the only
   * identifier the event carries. Keyed on `id` this would compare a `cus_…`
   * against a column of cuids and match nobody, turning every subscription
   * event into a silent no-op.
   */
  it('filters on stripeCustomerId, not on the user id', async () => {
    await applySubscriptionState(CUSTOMER_ID, SUBSCRIPTION_ID, true);

    const [args] = updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];

    expect(args.where).toEqual({ stripeCustomerId: CUSTOMER_ID });
    expect(args.where).not.toHaveProperty('id');
  });

  it('grants Pro and records the subscription for an active subscription', async () => {
    await expect(
      applySubscriptionState(CUSTOMER_ID, SUBSCRIPTION_ID, true),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: CUSTOMER_ID },
      data: { isPro: true, stripeSubscriptionId: SUBSCRIPTION_ID },
    });
  });

  it('revokes Pro and clears the subscription when it has ended', async () => {
    await applySubscriptionState(CUSTOMER_ID, null, false);

    expect(updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: CUSTOMER_ID },
      data: { isPro: false, stripeSubscriptionId: null },
    });
  });

  /**
   * Absolute rather than relative, which is what makes the webhook safe to
   * retry with no dedupe table: the same event applied twice writes the same
   * values the second time. Nothing may read the current value first.
   */
  it('sets absolute values, so applying the same event twice is a no-op', async () => {
    await applySubscriptionState(CUSTOMER_ID, SUBSCRIPTION_ID, true);
    await applySubscriptionState(CUSTOMER_ID, SUBSCRIPTION_ID, true);

    const [first, second] = updateMany.mock.calls as [
      [{ data: unknown }],
      [{ data: unknown }],
    ];

    expect(second[0].data).toEqual(first[0].data);
    expect(findUnique).not.toHaveBeenCalled();
  });

  /**
   * `updateMany` rather than `update` so an unknown customer is a count of
   * zero instead of a thrown P2025 — Phase 2's webhook has to log and
   * acknowledge that, never retry it forever.
   */
  it('reports false for a customer no row matches', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      applySubscriptionState('cus_unknown', SUBSCRIPTION_ID, true),
    ).resolves.toBe(false);
  });

  // It is called from a webhook, which has no session at all.
  it('does not consult the session', async () => {
    await applySubscriptionState(CUSTOMER_ID, SUBSCRIPTION_ID, true);

    expect(session).not.toHaveBeenCalled();
  });
});
