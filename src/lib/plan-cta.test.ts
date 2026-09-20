/**
 * Six combinations, and getting one wrong has a real cost: a signed-in Pro
 * user handed a checkout button opens a second subscription against the same
 * account, and a signed-out visitor handed one reaches an action that can only
 * refuse them. That is why this is a function with tests rather than a ternary
 * inside `PlanCard`.
 */
import { describe, expect, it } from 'vitest';

import { planCta } from './plan-cta';

const SIGNED_OUT = { isSignedIn: false, isPro: false };
const FREE = { isSignedIn: true, isPro: false };
const PRO = { isSignedIn: true, isPro: true };

describe('planCta, the Pro card', () => {
  it('sends a signed-out visitor to register — checkout needs an account to bill', () => {
    expect(planCta('pro', SIGNED_OUT, 'Get DevFetch Pro')).toEqual({
      kind: 'link',
      label: 'Get DevFetch Pro',
      href: '/register',
    });
  });

  it('offers checkout to the one viewer who can actually buy: signed in and free', () => {
    expect(planCta('pro', FREE, 'Get DevFetch Pro')).toEqual({
      kind: 'checkout',
      label: 'Get DevFetch Pro',
    });
  });

  it('never offers checkout to someone already paying', () => {
    // A second checkout would open a second subscription and bill them twice.
    expect(planCta('pro', PRO, 'Get DevFetch Pro')).toEqual({
      kind: 'link',
      label: 'Manage your plan',
      href: '/settings',
    });
  });
});

describe('planCta, the Free card', () => {
  it('sends a signed-out visitor to register', () => {
    expect(planCta('free', SIGNED_OUT, 'Start for free')).toEqual({
      kind: 'link',
      label: 'Start for free',
      href: '/register',
    });
  });

  it('never sends a signed-in viewer to register, which would bounce them back', () => {
    expect(planCta('free', FREE, 'Start for free')).toEqual({
      kind: 'link',
      label: 'Go to dashboard',
      href: '/dashboard',
    });
  });

  it('reads the same for a Pro viewer, who is above this plan rather than on it', () => {
    expect(planCta('free', PRO, 'Start for free')).toMatchObject({ href: '/dashboard' });
  });
});

describe('planCta, in general', () => {
  it('only ever yields a checkout from the Pro card', () => {
    const everyCombination = (['free', 'pro'] as const).flatMap((plan) =>
      [SIGNED_OUT, FREE, PRO].map((viewer) => ({ plan, cta: planCta(plan, viewer, 'x') })),
    );

    const checkouts = everyCombination.filter(({ cta }) => cta.kind === 'checkout');

    expect(checkouts).toHaveLength(1);
    expect(checkouts[0].plan).toBe('pro');
  });

  it('gives every link a destination, so no card can render a button going nowhere', () => {
    for (const plan of ['free', 'pro'] as const) {
      for (const viewer of [SIGNED_OUT, FREE, PRO]) {
        const cta = planCta(plan, viewer, 'x');

        if (cta.kind === 'link') expect(cta.href).toMatch(/^\/\w/);

        expect(cta.label.length).toBeGreaterThan(0);
      }
    }
  });
});
