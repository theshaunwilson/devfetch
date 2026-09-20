/**
 * The free tier's ceilings, as pure logic — no database, no session, nothing
 * mocked.
 *
 * Two properties are worth pinning beyond the arithmetic. The boundary is
 * exclusive, so a free account holds 50 items rather than 51; and the two
 * constants are checked against the copy on `/`, which advertises them to
 * anyone who visits, so the gate and the promise cannot drift apart.
 */
import { describe, expect, it } from 'vitest';

import { FREE_PLAN } from '@/components/home/content';

import {
  FREE_COLLECTION_LIMIT,
  FREE_ITEM_LIMIT,
  isWithinLimit,
  limitMessage,
} from './usage-limits';

describe('isWithinLimit', () => {
  describe('items on the free tier', () => {
    it('allows the 50th item, at a count of 49', () => {
      expect(isWithinLimit('items', 49, false)).toBe(true);
    });

    // The count is what exists now, so at exactly the limit the next one is
    // refused. `<=` here would quietly make the advertised 50 into 51.
    it('refuses at exactly the limit', () => {
      expect(isWithinLimit('items', 50, false)).toBe(false);
    });

    it('refuses past the limit, which a pre-existing account can be', () => {
      expect(isWithinLimit('items', 51, false)).toBe(false);
      expect(isWithinLimit('items', 500, false)).toBe(false);
    });

    it('allows an empty account', () => {
      expect(isWithinLimit('items', 0, false)).toBe(true);
    });
  });

  describe('collections on the free tier', () => {
    it('allows the 3rd collection, at a count of 2', () => {
      expect(isWithinLimit('collections', 2, false)).toBe(true);
    });

    it('refuses at exactly the limit', () => {
      expect(isWithinLimit('collections', 3, false)).toBe(false);
    });

    it('refuses past the limit', () => {
      expect(isWithinLimit('collections', 4, false)).toBe(false);
    });
  });

  /**
   * Pro is the check not applying, never an `Infinity` ceiling. These counts
   * are all far past both free limits: if the bypass were dropped, every one
   * of them would refuse.
   */
  describe('Pro', () => {
    it('allows every count, at both kinds', () => {
      for (const count of [0, 3, 50, 51, 10_000]) {
        expect(isWithinLimit('items', count, true)).toBe(true);
        expect(isWithinLimit('collections', count, true)).toBe(true);
      }
    });
  });

  // Each kind reads its own ceiling: 3 collections must not be allowed the
  // items limit, nor 50 items the collections one.
  it('does not apply one kind’s ceiling to the other', () => {
    expect(isWithinLimit('collections', 49, false)).toBe(false);
    expect(isWithinLimit('items', 3, false)).toBe(true);
  });
});

describe('limitMessage', () => {
  it('names the item limit and the kind', () => {
    const message = limitMessage('items');

    expect(message).toContain('50');
    expect(message).toContain('items');
  });

  it('names the collection limit and the kind', () => {
    const message = limitMessage('collections');

    expect(message).toContain('3');
    expect(message).toContain('collections');
  });

  // A refusal that does not say which ceiling was hit is not actionable.
  it('says something different for each kind', () => {
    expect(limitMessage('items')).not.toBe(limitMessage('collections'));
  });
});

/**
 * The numbers are a public promise before they are a gate. `/` renders these
 * strings on the Free plan card, so changing a constant without changing the
 * copy would advertise one ceiling and enforce another.
 */
describe('parity with the plan advertised on /', () => {
  it('matches the item limit in the marketing copy', () => {
    expect(FREE_PLAN.features).toContain(`${FREE_ITEM_LIMIT} items`);
  });

  it('matches the collection limit in the marketing copy', () => {
    expect(FREE_PLAN.features).toContain(`${FREE_COLLECTION_LIMIT} collections`);
  });
});
