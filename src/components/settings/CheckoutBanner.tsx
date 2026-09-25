'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface CheckoutBannerProps {
  isPro: boolean;
}

/**
 * Reports the outcome Stripe sent the browser back with.
 *
 * Renders nothing — it exists to fire one toast and then take the parameter
 * out of the URL, so a reload or a shared link does not re-announce a checkout
 * that happened once. The page mounts its own `<Toaster />`, which is what
 * gives this somewhere to land.
 *
 * A client component rather than reading `searchParams` on the page, because
 * `sonner` is a client-side surface — and it is a toast rather than the inline
 * banner the auth pages use, since this is news about something that already
 * finished, not a state the form is in.
 *
 * **What the row says, not what the URL says.** `?checkout=success` only means
 * Stripe sent the browser back — anyone can type it, and the webhook that
 * grants Pro usually lands a moment after the redirect. So the welcome waits
 * for `isPro`, read from the row by the page; until then the toast says the
 * payment was received, which is true, instead of announcing Pro beside a
 * billing card still showing the free plan.
 */
export function CheckoutBanner({ isPro }: CheckoutBannerProps) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const outcome = params.get('checkout');

  // React 19 mounts effects twice in development, and the replace below is
  // async enough that the second pass still sees the parameter — so the guard
  // is what stops one checkout toasting twice.
  const announced = useRef(false);

  useEffect(() => {
    if (!outcome || announced.current) return;

    announced.current = true;

    if (outcome === 'success') {
      if (isPro) {
        toast.success('Welcome to Pro. Your subscription is active.');
      } else {
        toast('Payment received. Your Pro plan is activating — reload in a moment.');
      }
    } else if (outcome === 'cancelled') {
      toast('Checkout cancelled. You are still on the free plan.');
    }

    // `replace`, so the cleaned URL does not become a history entry the back
    // button can walk into and re-announce.
    router.replace(pathname, { scroll: false });
  }, [isPro, outcome, pathname, router]);

  return null;
}
