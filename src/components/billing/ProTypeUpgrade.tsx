import { LockIcon } from 'lucide-react';

import { CheckoutButtons } from '@/components/settings/BillingButtons';
import { Card, CardContent } from '@/components/ui/card';
import { capitalize } from '@/lib/format';
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from '@/lib/usage-limits';

interface ProTypeUpgradeProps {
  /** The gated type's own slug — `file` or `image`. */
  typeSlug: string;
}

/**
 * What a free account gets instead of `/items/file` or `/items/image`.
 *
 * A server component with the checkout buttons as its one client child, the
 * shape `BillingSettings` uses. `CheckoutButtons` is reused rather than a link
 * to `/settings` being offered: by the time somebody is reading this page the
 * decision is the one in front of them, so sending them elsewhere to act on it
 * would only add a hop. It toasts its own failures, and every route that
 * renders this page is inside `AppShell`, which mounts the `<Toaster />`.
 *
 * The free ceilings come from `usage-limits` rather than being written out
 * here, so this page, the gate that enforces them and the promise made on `/`
 * cannot drift into disagreeing.
 */
export function ProTypeUpgrade({ typeSlug }: ProTypeUpgradeProps) {
  const typeName = capitalize(typeSlug);

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{typeName}</h1>
      <p className="mt-1 text-muted-foreground">Part of DevFetch Pro</p>

      <Card className="mt-8 max-w-2xl">
        <CardContent className="flex flex-col items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <LockIcon className="size-5" />
          </span>

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{typeName} uploads are a Pro feature</h2>
            <p className="text-sm text-muted-foreground">
              Free accounts hold up to {FREE_ITEM_LIMIT} items across {FREE_COLLECTION_LIMIT}{' '}
              collections, with no uploads. Pro adds files and images, and takes both of those
              limits off.
            </p>
            <p className="text-sm text-muted-foreground">
              Anything you have already uploaded stays yours — those items are still on your
              dashboard, in search and in their collections.
            </p>
          </div>

          <CheckoutButtons />
        </CardContent>
      </Card>
    </div>
  );
}
