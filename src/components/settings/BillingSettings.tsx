import { FreeBadge } from '@/components/billing/FreeBadge';
import { ProBadge } from '@/components/billing/ProBadge';
import { CheckoutButtons, ManageBillingButton } from '@/components/settings/BillingButtons';
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
  /** How many the account holds now, against the plan's ceiling. */
  itemCount: number;
  collectionCount: number;
}

/**
 * The plan card: what the account is on, what it has used of it, and the one
 * action that changes it.
 *
 * A server component with a client child holding the buttons, the shape
 * `AccountSettings` uses — the card itself needs no interactivity, and keeping
 * the transition in a leaf means the rest of the page stays server-rendered.
 *
 * The counts are not fetched here: `src/app/settings/page.tsx` already reads
 * both totals for the delete confirmation, so the usage lines ride on data the
 * page is holding rather than adding two queries for a pair of numbers.
 *
 * The ceilings come from `usage-limits` rather than being written out here, so
 * the numbers on this card, the gate that enforces them and the promise made
 * on `/` cannot drift into disagreeing.
 */
export function BillingSettings({
  isPro,
  canManage,
  itemCount,
  collectionCount,
}: BillingSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and billing.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">Current plan</h3>
              {isPro ? <ProBadge /> : <FreeBadge />}
            </div>

            <dl className="space-y-3 sm:max-w-xs">
              <UsageLine
                label="Items"
                count={itemCount}
                limit={isPro ? null : FREE_ITEM_LIMIT}
              />
              <UsageLine
                label="Collections"
                count={collectionCount}
                limit={isPro ? null : FREE_COLLECTION_LIMIT}
              />
            </dl>
          </div>

          {/*
            The checkout buttons go straight to Stripe, deliberately — this is
            the one place that does not route through `/upgrade`. Somebody who
            has opened the billing section is already past the pitch: their
            plan and their usage are on the screen and the buttons name both
            prices, so a page explaining why to upgrade would be a hop between
            them and the thing they came to do. A locked type page is the
            opposite case and redirects to `/upgrade` outright — nobody lands
            on `/items/file` meaning to buy, so there is nothing to sell there.
          */}
          <div className="sm:shrink-0">
            {isPro ? canManage && <ManageBillingButton /> : <CheckoutButtons />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * One resource's usage against the plan.
 *
 * `limit` is null for Pro, which has no ceiling to compare against — the same
 * way `isWithinLimit` expresses an unlimited plan as the check not applying
 * rather than as an `Infinity` sentinel. Without a ceiling there is nothing to
 * fill, so the meter is drawn only on the free plan.
 *
 * The meter is `aria-hidden`: it says nothing the `n / 50` beside it does not
 * already say in text, and a `progressbar` role here would announce the same
 * number twice. That is also why it is a plain div rather than `ui/progress` —
 * that one exists to report upload progress out loud, and its indicator is a
 * hardcoded `bg-primary` this cannot tint on the way to the ceiling. The width
 * is the one inline style on the page, for the reason shadcn's own `Progress`
 * carries one: a computed percentage has no utility class to be.
 *
 * At or over the ceiling the number is tinted destructive. Over is reachable
 * rather than hypothetical — a lapsed subscription leaves the account holding
 * more than the free plan allows, which is read-only overage by design.
 */
function UsageLine({
  label,
  count,
  limit,
}: {
  label: string;
  count: number;
  limit: number | null;
}) {
  const atLimit = limit !== null && count >= limit;
  const filled = limit === null ? 0 : Math.min(100, (count / limit) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className={atLimit ? 'font-medium text-destructive' : 'font-medium'}>
          {count} / {limit ?? 'Unlimited'}
        </dd>
      </div>

      {limit !== null && (
        <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${atLimit ? 'bg-destructive' : 'bg-foreground/40'}`}
            style={{ width: `${filled}%` }}
          />
        </div>
      )}
    </div>
  );
}
