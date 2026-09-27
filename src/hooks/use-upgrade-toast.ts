'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Longer than sonner's 4s default: this one asks the reader to make a decision
 * rather than telling them something finished.
 */
const UPGRADE_TOAST_DURATION = 8000;

/**
 * Reports a refusal that means *you need Pro* — red, top centre, and offering
 * the one thing that resolves it.
 *
 * Deliberately not `toast.error`, which the `Toaster` draws bottom-right in the
 * dark popover colour: that is the right treatment for "that failed, try
 * again", and the wrong one for a wall the account has hit. Which refusals are
 * upgrade refusals is decided on the server and carried back as
 * `upgradeRequired` on the action's result, never matched out of the message
 * text here.
 *
 * A hook rather than a plain function so Upgrade can navigate through the
 * router, keeping it a client transition like every other link in the app.
 */
export function useUpgradeToast() {
  const router = useRouter();

  return useCallback(
    (message: string) => {
      toast.error(message, {
        position: 'top-center',
        className: 'toast-upgrade',
        duration: UPGRADE_TOAST_DURATION,
        action: {
          label: 'Upgrade',
          // `/settings` holds the checkout buttons, so this lands on the plan
          // row rather than on a page that only explains the plan.
          onClick: () => router.push('/settings'),
        },
      });
    },
    [router],
  );
}

/** The part of a failed action result that decides how it is reported. */
interface FailedResult {
  error: string;
  upgradeRequired?: boolean;
}

/**
 * Reports a failed action the way its result asks: the upgrade alert when the
 * server marked it as a Pro wall, an ordinary error toast otherwise.
 *
 * The one place that split is made, so every form and AI button draws the two
 * kinds of refusal the same way.
 */
export function useFailureToast() {
  const upgradeToast = useUpgradeToast();

  return useCallback(
    (result: FailedResult) => {
      if (result.upgradeRequired) {
        upgradeToast(result.error);
      } else {
        toast.error(result.error);
      }
    },
    [upgradeToast],
  );
}
