'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth } from '@/auth';
import { absoluteUrl } from '@/lib/app-url';
import { getBillingStatus, linkStripeCustomer } from '@/lib/db/billing';
import { getPriceId, getStripe } from '@/lib/stripe';
import type { BillingInterval, OpenBillingPortalResult, StartCheckoutResult } from '@/types/billing';

/**
 * The interval arrives from a button on a public page, so it is parsed rather
 * than trusted to its TypeScript type — a server action is a public endpoint,
 * and `getPriceId` would otherwise be handed whatever was posted.
 */
const intervalSchema = z.enum(['monthly', 'yearly']);

/** Where Stripe sends the browser back to, in both outcomes. */
const CHECKOUT_SUCCESS_URL = '/settings?checkout=success';
const CHECKOUT_CANCELLED_URL = '/settings?checkout=cancelled';
const PORTAL_RETURN_URL = '/settings';

const GENERIC_ERROR = 'Could not start checkout. Please try again.';

/**
 * Finds or creates this user's Stripe customer, and records it on the row.
 *
 * **Lazily, on the first checkout attempt** — not at registration. A free user
 * who never upgrades leaves no trace in Stripe at all, and signing up does not
 * depend on a third-party call that can fail.
 *
 * `metadata.userId` goes on the customer so a webhook can still name its user
 * if the row write below ever failed after the customer was created. The
 * webhook does not read it — it resolves by `stripeCustomerId`, which is
 * `@unique` — but it is the only breadcrumb back if that link is ever missing.
 */
async function resolveCustomerId(
  userId: string,
  email: string | null | undefined,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;

  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });

  await linkStripeCustomer(userId, customer.id);

  return customer.id;
}

/**
 * Sends the signed-in user to Stripe's hosted Checkout for one of the two Pro
 * prices.
 *
 * Only ever returns on failure — see `StartCheckoutResult`.
 */
export async function startCheckout(interval: BillingInterval): Promise<StartCheckoutResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Your session has expired. Sign in again.' };
  }

  const parsed = intervalSchema.safeParse(interval);

  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const billing = await getBillingStatus();

  if (!billing) {
    return { error: 'Your session has expired. Sign in again.' };
  }

  // Already paying. A second checkout would open a second subscription against
  // the same account and bill them twice — the portal is the door for changing
  // an existing plan, and the settings card offers exactly that instead.
  if (billing.isPro) {
    return { error: 'You are already on Pro. Use Manage billing to change your plan.' };
  }

  let url: string | null;

  try {
    const customerId = await resolveCustomerId(
      session.user.id,
      session.user.email,
      billing.stripeCustomerId,
    );

    const checkout = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getPriceId(parsed.data), quantity: 1 }],
      // Absolute, and from `APP_URL` rather than the request's `Host` header,
      // which a caller controls — the reason the verification emails build
      // their links the same way. A spoofed Host here would land a paying
      // customer on somebody else's origin.
      success_url: absoluteUrl(CHECKOUT_SUCCESS_URL),
      cancel_url: absoluteUrl(CHECKOUT_CANCELLED_URL),
      // On the subscription as well as the customer, so the id is reachable
      // from either object a webhook might be holding.
      subscription_data: { metadata: { userId: session.user.id } },
    });

    url = checkout.url;
  } catch (error) {
    console.error('Could not start Stripe checkout:', error);

    return { error: GENERIC_ERROR };
  }

  if (!url) {
    console.error('Stripe returned a checkout session with no URL.');

    return { error: GENERIC_ERROR };
  }

  // **Outside the `try`.** `redirect()` works by throwing `NEXT_REDIRECT`, so
  // inside it the `catch` above would swallow the redirect, report a generic
  // failure and leave the user sitting on the settings page.
  redirect(url);
}

/**
 * Sends the signed-in user to Stripe's billing portal, where they can change
 * plan, update their card, see invoices and cancel.
 *
 * Needs an existing customer and never creates one: there is nothing to manage
 * before a first checkout. The settings card only offers this when
 * `stripeCustomerId` is set, so reaching the refusal means posting at the
 * action directly.
 */
export async function openBillingPortal(): Promise<OpenBillingPortalResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Your session has expired. Sign in again.' };
  }

  const billing = await getBillingStatus();

  if (!billing?.stripeCustomerId) {
    return { error: 'There is no billing account to manage yet.' };
  }

  let url: string;

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: absoluteUrl(PORTAL_RETURN_URL),
    });

    url = portal.url;
  } catch (error) {
    console.error('Could not open the Stripe billing portal:', error);

    return { error: 'Could not open billing. Please try again.' };
  }

  // Outside the `try`, for the reason `startCheckout` explains.
  redirect(url);
}
