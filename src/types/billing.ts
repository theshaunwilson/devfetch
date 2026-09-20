/** Which of the two recurring prices on the DevFetch Pro product is meant. */
export type BillingInterval = 'monthly' | 'yearly';

/**
 * An account's billing record: the plan flag and the two Stripe ids that name
 * it on Stripe's side.
 *
 * `docs/stripe-integration-plan.md` §5.6 proposed this instead as what the
 * settings card renders — `{ isPro, canManage }` — but §5.4's own checkout and
 * portal actions read `stripeCustomerId` off the value `getBillingStatus`
 * returns, so the two halves of the plan disagreed. This is the row, because
 * that is what every caller needs; `canManage` is one expression away
 * (`stripeCustomerId !== null`) and is derived where it is rendered rather
 * than stored here, since a stored copy can only ever disagree with the id it
 * was derived from.
 */
export interface BillingStatus {
  isPro: boolean;
  /**
   * Null until the account's first checkout. A Pro user can have none — an
   * account granted Pro by hand has nothing for the billing portal to manage.
   */
  stripeCustomerId: string | null;
  /** Null for an account that has never had a subscription, or lost the one it had. */
  stripeSubscriptionId: string | null;
}
