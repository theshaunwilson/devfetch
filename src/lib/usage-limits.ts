/**
 * The free tier's ceilings, and the check that applies them.
 *
 * Pure on purpose: no Prisma, no session, no `server-only`. The count comes
 * from the caller, so every branch is unit-testable without a database, and
 * the same function can be called from an action, a route handler or a page.
 *
 * Not a database column. Which ceilings apply to which plan is a pricing
 * decision, not a property of a row — the call `src/lib/pro.ts` makes for
 * which item types are Pro, and `src/lib/features.ts` makes for whether email
 * verification is on.
 */

/**
 * These two numbers are a public promise, not an internal setting:
 * `src/components/home/content.tsx` advertises "50 items" and "3 collections"
 * on `/`. They cannot be changed here alone — the copy has to move with them,
 * and `src/lib/usage-limits.test.ts` fails if the two drift apart.
 */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/** The two kinds of row the free tier caps. */
export type UsageLimitKind = 'items' | 'collections';

const LIMITS: Record<UsageLimitKind, number> = {
  items: FREE_ITEM_LIMIT,
  collections: FREE_COLLECTION_LIMIT,
};

/**
 * Whether one more row may be created.
 *
 * `currentCount` is how many exist now, so the comparison is `<`: at exactly
 * the limit the next one is refused, which is what makes 50 the number of
 * items a free account can hold rather than the number it can hold plus one.
 *
 * Pro is expressed as the check not applying, never as an `Infinity` ceiling —
 * an unlimited plan has no limit to compare against, and a sentinel number
 * invites arithmetic that a boolean cannot get wrong.
 */
export function isWithinLimit(
  kind: UsageLimitKind,
  currentCount: number,
  isPro: boolean,
): boolean {
  if (isPro) return true;

  return currentCount < LIMITS[kind];
}

/**
 * The sentence a refused create shows. Names the number, so the refusal is
 * actionable rather than only a refusal.
 */
export function limitMessage(kind: UsageLimitKind): string {
  return kind === 'items'
    ? `Free accounts are limited to ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`
    : `Free accounts are limited to ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;
}
