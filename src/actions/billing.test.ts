/**
 * `startCheckout` is a public endpoint that spends money, so what is pinned
 * here is the order it decides things in — session, then plan, then customer,
 * then the session it opens — and the two properties that cost real money if
 * they slip: that an existing Stripe customer is reused rather than duplicated,
 * and that an account already paying is refused instead of being sold a second
 * subscription.
 *
 * Same pattern as `src/actions/auth.test.ts`: mock the module boundary —
 * `@/auth`, `@/lib/stripe`, `@/lib/db/billing`, `next/navigation` — and leave
 * the Zod enum real, so the action is tested against the rules production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db/billing', () => ({
  getBillingStatus: vi.fn(),
  linkStripeCustomer: vi.fn(),
}));
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn(), getPriceId: vi.fn() }));
vi.mock('next/navigation', () => ({
  // The real one throws `NEXT_REDIRECT`; this throws too, so a test can tell a
  // redirect from a return — which is the entire success/failure distinction.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const { auth } = await import('@/auth');
const { getBillingStatus, linkStripeCustomer } = await import('@/lib/db/billing');
const { getStripe, getPriceId } = await import('@/lib/stripe');
const { redirect } = await import('next/navigation');
const { openBillingPortal, startCheckout } = await import('./billing');

const session = vi.mocked(auth);
const billing = vi.mocked(getBillingStatus);
const linkCustomer = vi.mocked(linkStripeCustomer);
const stripe = vi.mocked(getStripe);
const priceId = vi.mocked(getPriceId);
const goTo = vi.mocked(redirect);

const USER_ID = 'user_1';
const CUSTOMER_ID = 'cus_existing';

const listSubscriptions = vi.fn();
const createCustomer = vi.fn();
const createCheckout = vi.fn();
const createPortal = vi.fn();

/** Only the three calls the actions make; the real client has hundreds. */
const stripeClient = {
  subscriptions: { list: listSubscriptions },
  customers: { create: createCustomer },
  checkout: { sessions: { create: createCheckout } },
  billingPortal: { sessions: { create: createPortal } },
};

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({
    user: { id: USER_ID, email: 'demo@devfetch.io' },
  } as unknown as never);
  billing.mockResolvedValue({
    isPro: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  stripe.mockReturnValue(stripeClient as unknown as ReturnType<typeof getStripe>);
  priceId.mockReturnValue('price_monthly');
  listSubscriptions.mockResolvedValue({ data: [] });
  createCustomer.mockResolvedValue({ id: 'cus_new' });
  createCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/abc' });
  createPortal.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/xyz' });
  goTo.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

/** The checkout arguments, once, without retyping the cast at every call. */
function checkoutArgs(): {
  mode: string;
  customer: string;
  line_items: { price: string; quantity: number }[];
  success_url: string;
  cancel_url: string;
  subscription_data: { metadata: Record<string, string> };
} {
  return createCheckout.mock.calls[0][0];
}

describe('startCheckout, refusals', () => {
  it('refuses with no session, and never reaches Stripe', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(startCheckout('monthly')).resolves.toEqual({
      error: 'Your session has expired. Sign in again.',
    });
    expect(stripe).not.toHaveBeenCalled();
  });

  it('refuses a session whose user row is gone', async () => {
    // The JWT outlives the row it names, so the lookup decides.
    billing.mockResolvedValue(null);

    await expect(startCheckout('monthly')).resolves.toMatchObject({
      error: expect.stringContaining('session has expired'),
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('refuses someone already on Pro, rather than selling a second subscription', async () => {
    billing.mockResolvedValue({
      isPro: true,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: 'sub_1',
    });

    await expect(startCheckout('monthly')).resolves.toEqual({
      error: 'You are already on Pro. Use Manage billing to change your plan.',
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('refuses an interval that is not one of the two prices', async () => {
    // The value arrives from a button on a public page, so it is parsed.
    await expect(startCheckout('weekly' as never)).resolves.toMatchObject({
      error: expect.stringContaining('Could not start checkout'),
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('reports a Stripe failure rather than throwing it at the caller', async () => {
    createCheckout.mockRejectedValue(new Error('card_declined'));

    await expect(startCheckout('monthly')).resolves.toMatchObject({
      error: expect.stringContaining('Could not start checkout'),
    });
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe('startCheckout, the Stripe customer', () => {
  it('creates one lazily when the account has none', async () => {
    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');

    expect(createCustomer).toHaveBeenCalledTimes(1);
    // Recorded on the row, so the webhook can resolve a user from the customer
    // id alone rather than trusting metadata.
    expect(linkCustomer).toHaveBeenCalledWith(USER_ID, 'cus_new');
    expect(checkoutArgs().customer).toBe('cus_new');
  });

  it('reuses an existing one rather than creating a duplicate', async () => {
    billing.mockResolvedValue({
      isPro: false,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: null,
    });

    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');

    expect(createCustomer).not.toHaveBeenCalled();
    expect(linkCustomer).not.toHaveBeenCalled();
    expect(checkoutArgs().customer).toBe(CUSTOMER_ID);
  });

  it('stamps the user id on the customer it creates', async () => {
    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { userId: USER_ID } }),
    );
  });
});

describe('startCheckout, the session it opens', () => {
  beforeEach(async () => {
    await startCheckout('monthly').catch(() => {});
  });

  it('opens it in subscription mode', () => {
    expect(checkoutArgs().mode).toBe('subscription');
  });

  it('stamps the user id on the subscription as well as the customer', () => {
    // Either object a webhook is holding can then name its user.
    expect(checkoutArgs().subscription_data).toEqual({ metadata: { userId: USER_ID } });
  });

  it('sends the browser to the URL Stripe handed back', () => {
    expect(goTo).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/abc');
  });

  it('builds both return URLs absolutely, never from a caller-supplied host', () => {
    expect(checkoutArgs().success_url).toMatch(/^https?:\/\/[^/]+\/settings\?checkout=success$/);
    expect(checkoutArgs().cancel_url).toMatch(/^https?:\/\/[^/]+\/settings\?checkout=cancelled$/);
  });
});

describe('startCheckout, the interval', () => {
  it('asks for the yearly price when yearly is chosen', async () => {
    priceId.mockReturnValue('price_yearly');

    await expect(startCheckout('yearly')).rejects.toThrow('NEXT_REDIRECT');

    expect(priceId).toHaveBeenCalledWith('yearly');
    expect(checkoutArgs().line_items).toEqual([{ price: 'price_yearly', quantity: 1 }]);
  });

  it('asks for the monthly price when monthly is chosen', async () => {
    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');

    expect(priceId).toHaveBeenCalledWith('monthly');
  });
});

describe('openBillingPortal', () => {
  it('refuses with no session', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(openBillingPortal()).resolves.toMatchObject({
      error: expect.stringContaining('session has expired'),
    });
    expect(createPortal).not.toHaveBeenCalled();
  });

  it('refuses an account with no Stripe customer, and never creates one', async () => {
    // A Pro account granted by hand has nothing for the portal to manage.
    billing.mockResolvedValue({
      isPro: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });

    await expect(openBillingPortal()).resolves.toEqual({
      error: 'There is no billing account to manage yet.',
    });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createPortal).not.toHaveBeenCalled();
  });

  it('opens the portal for the account’s own customer and redirects there', async () => {
    billing.mockResolvedValue({
      isPro: true,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: 'sub_1',
    });

    await expect(openBillingPortal()).rejects.toThrow('NEXT_REDIRECT');

    expect(createPortal).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER_ID }),
    );
    expect(goTo).toHaveBeenCalledWith('https://billing.stripe.com/p/session/xyz');
  });

  it('builds the return URL absolutely', async () => {
    billing.mockResolvedValue({
      isPro: true,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: 'sub_1',
    });

    await openBillingPortal().catch(() => {});

    expect(createPortal.mock.calls[0][0].return_url).toMatch(/^https?:\/\/[^/]+\/settings$/);
  });
});

/**
 * The gap that charged a real account twice: `isPro` is a cache the webhook
 * fills, so while the webhook is lagging or down it reads false even though a
 * paid subscription exists — and nothing stopped the caller opening another.
 * Stripe is the authority, so it is asked.
 */
describe('startCheckout, the already-subscribed guard', () => {
  const withCustomer = {
    isPro: false,
    stripeCustomerId: CUSTOMER_ID,
    stripeSubscriptionId: null,
  };

  it('refuses when Stripe reports a live subscription, even though isPro is false', async () => {
    billing.mockResolvedValue(withCustomer);
    listSubscriptions.mockResolvedValue({ data: [{ id: 'sub_1', status: 'active' }] });

    await expect(startCheckout('monthly')).resolves.toMatchObject({
      error: expect.stringContaining('already have an active subscription'),
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('refuses on a trialing subscription too, matching what grants Pro', async () => {
    billing.mockResolvedValue(withCustomer);
    listSubscriptions.mockResolvedValue({ data: [{ id: 'sub_1', status: 'trialing' }] });

    await expect(startCheckout('monthly')).resolves.toMatchObject({
      error: expect.stringContaining('already have an active subscription'),
    });
  });

  it('allows checkout when every past subscription is dead', async () => {
    billing.mockResolvedValue(withCustomer);
    listSubscriptions.mockResolvedValue({
      data: [
        { id: 'sub_old', status: 'canceled' },
        { id: 'sub_older', status: 'incomplete_expired' },
      ],
    });

    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');
    expect(createCheckout).toHaveBeenCalled();
  });

  it('asks Stripe about this customer only', async () => {
    billing.mockResolvedValue(withCustomer);

    await startCheckout('monthly').catch(() => {});

    expect(listSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER_ID, status: 'all' }),
    );
  });

  it('never asks for a first-time customer, so a new checkout costs no extra call', async () => {
    // Default billing has no stripeCustomerId — there is nothing to ask about.
    await expect(startCheckout('monthly')).rejects.toThrow('NEXT_REDIRECT');

    expect(listSubscriptions).not.toHaveBeenCalled();
  });

  it('fails closed when Stripe cannot be reached, rather than charging again', async () => {
    billing.mockResolvedValue(withCustomer);
    listSubscriptions.mockRejectedValue(new Error('network down'));

    // "We could not tell whether you are already paying" must never resolve to
    // "charge them again".
    await expect(startCheckout('monthly')).resolves.toMatchObject({
      error: expect.stringContaining('Could not start checkout'),
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
