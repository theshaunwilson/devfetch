/**
 * The lazy client and the price ids.
 *
 * The property under test is not "does it build a client" but *when* it reads
 * the environment: at call time, never at import. A module-scope
 * `new Stripe(process.env.STRIPE_SECRET_KEY!)` would make `next build` depend
 * on the build machine holding the secret, so the test that matters is the one
 * where a second stub flips the answer inside a single module instance.
 *
 * Nothing here reaches Stripe. Constructing the SDK issues no request, and no
 * method on the client is called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'sk_test_key';

/**
 * A fresh module registry per test, so the module-level client cache starts
 * empty. Without it the first test to build a client would hand its instance
 * to every test after it, and the missing-key branch would never be reached
 * again.
 */
async function loadModule() {
  vi.resetModules();

  return import('./stripe');
}

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', undefined);
  vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', undefined);
  vi.stubEnv('STRIPE_PRICE_ID_YEARLY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStripe', () => {
  it('throws when the key is unset', async () => {
    const { getStripe } = await loadModule();

    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not set');
  });

  it('throws for a key that is only whitespace', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '   ');

    const { getStripe } = await loadModule();

    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not set');
  });

  it('builds a client when the key is set', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', SECRET);

    const { getStripe } = await loadModule();

    expect(getStripe()).toBeDefined();
  });

  /**
   * The whole reason the module exports a function rather than a constant.
   * Importing the module with no key set must not throw and must not decide
   * anything — one instance, two answers, driven only by the environment at
   * the moment of the call.
   */
  it('reads the key at call time, not at import', async () => {
    const { getStripe } = await loadModule();

    expect(() => getStripe()).toThrow();

    vi.stubEnv('STRIPE_SECRET_KEY', SECRET);

    expect(getStripe()).toBeDefined();
  });

  it('builds the client once and reuses it', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', SECRET);

    const { getStripe } = await loadModule();

    expect(getStripe()).toBe(getStripe());
  });
});

describe('getPriceId', () => {
  it('returns the monthly price for the monthly interval', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly');
    vi.stubEnv('STRIPE_PRICE_ID_YEARLY', 'price_yearly');

    const { getPriceId } = await loadModule();

    expect(getPriceId('monthly')).toBe('price_monthly');
  });

  it('returns the yearly price for the yearly interval', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly');
    vi.stubEnv('STRIPE_PRICE_ID_YEARLY', 'price_yearly');

    const { getPriceId } = await loadModule();

    expect(getPriceId('yearly')).toBe('price_yearly');
  });

  // Charging the wrong price is worse than refusing to charge: a yearly button
  // that quietly bills monthly is a billing bug nobody notices for a year.
  it('does not fall back to the other interval when one is unset', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly');

    const { getPriceId } = await loadModule();

    expect(() => getPriceId('yearly')).toThrow('Stripe price id for yearly is not set');
  });

  it('throws naming the interval when the monthly price is unset', async () => {
    const { getPriceId } = await loadModule();

    expect(() => getPriceId('monthly')).toThrow('Stripe price id for monthly is not set');
  });

  it('reads the price ids at call time, not at import', async () => {
    const { getPriceId } = await loadModule();

    expect(() => getPriceId('monthly')).toThrow();

    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly');

    expect(getPriceId('monthly')).toBe('price_monthly');
  });
});
