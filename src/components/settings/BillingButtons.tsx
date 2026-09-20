'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { openBillingPortal, startCheckout } from '@/actions/billing';
import { Button } from '@/components/ui/button';
import type { BillingInterval } from '@/types/billing';

/**
 * The two checkout buttons a free account sees.
 *
 * One transition for both, so a second click while the first is in flight
 * cannot open two Checkout Sessions — both buttons disable together.
 *
 * Plain `<Button>`s, deliberately not an `AlertDialogAction` or a
 * `DropdownMenuItem`: both unmount on click, which tears down the transition
 * mid-request. This project has hit that three times — the sign-out form in
 * Auth Phase 3, the profile page's dialogs, and the collection card menu.
 */
export function CheckoutButtons() {
  const [isPending, startTransition] = useTransition();

  function upgrade(interval: BillingInterval) {
    startTransition(async () => {
      // Only ever returns on failure: success redirects to Stripe, which
      // throws `NEXT_REDIRECT` and never comes back here.
      const result = await startCheckout(interval);

      toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => upgrade('monthly')}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Starting…' : '$8 / month'}
      </Button>
      <Button
        disabled={isPending}
        onClick={() => upgrade('yearly')}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Starting…' : '$72 / year'}
      </Button>
    </div>
  );
}

/** The single button a paying account sees, opening Stripe's billing portal. */
export function ManageBillingButton() {
  const [isPending, startTransition] = useTransition();

  function manage() {
    startTransition(async () => {
      const result = await openBillingPortal();

      toast.error(result.error);
    });
  }

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={manage}
      className="w-full sm:w-auto"
    >
      {isPending ? 'Opening…' : 'Manage billing'}
    </Button>
  );
}
