import { ProBadge } from '@/components/billing/ProBadge';
import { CheckoutButtons, ManageBillingButton } from '@/components/settings/BillingButtons';
import { SettingsRow } from '@/components/settings/SettingsRow';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from '@/lib/usage-limits';

interface BillingSettingsProps {
  isPro: boolean;
  /**
   * False for a Pro account with no Stripe customer — one granted by hand.
   * There is nothing for the portal to manage, so it is not offered rather
   * than offered and failing.
   */
  canManage: boolean;
}

/**
 * The plan row: what the account is on, and the one action that changes it.
 *
 * A server component with a client child holding the buttons, the shape
 * `AccountSettings` uses — the card itself needs no interactivity, and keeping
 * the transition in a leaf means the rest of the page stays server-rendered.
 *
 * The limits in the free description come from `usage-limits` rather than being
 * written out here, so the numbers on this card, the gate that enforces them
 * and the promise made on `/` cannot drift into disagreeing.
 */
export function BillingSettings({ isPro, canManage }: BillingSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Billing
          {isPro && <ProBadge />}
        </CardTitle>
        <CardDescription>Your plan, and what it includes.</CardDescription>
      </CardHeader>

      <CardContent className="divide-y">
        {isPro ? (
          <SettingsRow
            title="DevFetch Pro"
            description="Your subscription is active."
            action={canManage ? <ManageBillingButton /> : null}
          />
        ) : (
          <SettingsRow
            title="DevFetch Pro"
            description={`You are on the free plan — ${FREE_ITEM_LIMIT} items, ${FREE_COLLECTION_LIMIT} collections and no uploads. Pro is $8 a month, or $72 a year.`}
            /*
              Straight to Stripe, deliberately — this is the one place that
              does not route through `/upgrade`. Somebody who has opened the
              billing section is already past the pitch: their plan is on the
              screen, the row beside this names both prices, and a page
              explaining why to upgrade would be a hop between them and the
              thing they came to do. A locked type page is the opposite case
              and redirects to `/upgrade` outright — nobody lands on
              `/items/file` meaning to buy, so there is nothing to sell there.
            */
            action={<CheckoutButtons />}
          />
        )}
      </CardContent>
    </Card>
  );
}
