import { NextResponse } from 'next/server';

import { applySubscriptionState, clearSubscriptionState } from '@/lib/db/billing';
import { getStripe } from '@/lib/stripe';
import { subscriptionIntentFrom } from '@/lib/stripe-events';

/**
 * Stripe's webhook endpoint — the one route in this app that no session
 * authenticates.
 *
 * `src/proxy.ts` deliberately does not match `/api`, so nothing stands in front
 * of this, and nothing should: Stripe is the caller, and the `stripe-signature`
 * header is what proves it. That signature is the entire authentication story
 * here, which is why an unset secret is a 500 rather than a shrug — see below.
 *
 * **Idempotency needs no dedupe table.** Both writes set absolute values —
 * `applySubscriptionState` sets `isPro` and the subscription id outright rather
 * than toggling anything — so applying the same event twice changes nothing the
 * second time. That is what makes it safe to answer 500 on a handler error and
 * let Stripe retry.
 *
 * Runs on Node rather than the edge: `@/lib/db/billing` reaches Prisma.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  // Never a silent accept. Without the secret nothing can be verified, so
  // every caller would be trusted — refusing loudly is the only safe answer,
  // and 500 is honest: this is our misconfiguration, not a bad request.
  if (!secret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET is not set; refusing the request.');

    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // `request.text()`, never `request.json()`. The signature is an HMAC over the
  // exact bytes Stripe sent, and parsing then re-serialising produces different
  // bytes — key order, whitespace, number formatting — so verification would
  // fail every single time.
  const payload = await request.text();

  let event;

  try {
    // The async form works under both Node's crypto and the Web Crypto
    // provider, so this does not quietly depend on the route's runtime.
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    // Logged with the reason, answered without it: the caller failed to prove
    // who they are, and telling them why is help they have not earned.
    console.error('Stripe webhook: signature verification failed.', error);

    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const intent = subscriptionIntentFrom(event);

  // An event we do not act on — a type we did not subscribe to, a one-off
  // payment, or one missing the ids a write needs. Acknowledged, so Stripe
  // stops sending it.
  if (!intent) {
    return NextResponse.json({ received: true });
  }

  try {
    const matched =
      intent.kind === 'activate'
        ? await applySubscriptionState(intent.customerId, intent.subscriptionId, true)
        : await clearSubscriptionState(intent.customerId, intent.subscriptionId);

    if (!matched) {
      // No row held that customer — or, for a deactivation, not that
      // subscription. Both are 200: a retry would resolve neither, so Stripe
      // would be left redelivering an event forever. Logged, because an
      // unknown customer is worth knowing about.
      console.warn(
        `Stripe webhook: ${event.type} (${intent.kind}) matched no user for customer ${intent.customerId}.`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 so Stripe retries. Safe precisely because the handlers are
    // idempotent — a retry re-applies the same absolute state.
    console.error(`Stripe webhook: handling ${event.type} failed.`, error);

    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
