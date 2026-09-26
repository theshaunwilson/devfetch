import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AccountSettings } from '@/components/settings/AccountSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { CheckoutBanner } from '@/components/settings/CheckoutBanner';
import { EditorPreferencesSettings } from '@/components/settings/EditorPreferencesSettings';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getBillingStatus } from '@/lib/db/billing';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemStats } from '@/lib/db/items';
import { getProfileUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'Settings',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // The delete confirmation names what it is about to remove, so it needs
  // both totals; the profile page already runs exactly these three.
  // The editor preferences come from `AppShell`'s provider, which every
  // Monaco editor in the app already reads.
  const [user, itemStats, collectionStats, billing] = await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
    getBillingStatus(),
  ]);

  // The proxy already turns anonymous requests away; this catches the case it
  // cannot, a valid session whose user row is gone. It matters most here:
  // this is the page that deletes the account, so it is the likeliest to be
  // standing on a session that outlived its row.
  if (!user) {
    redirect(`${SIGN_IN_PATH}?callbackUrl=%2Fsettings`);
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* Reads `?checkout=`, so it suspends — the page is `force-dynamic` and
            never prerendered, but `useSearchParams` wants the boundary either
            way. It renders nothing, so there is nothing to fall back to. Its
            toast lands in `AppShell`'s `Toaster`. */}
        <Suspense fallback={null}>
          <CheckoutBanner isPro={billing?.isPro ?? false} />
        </Suspense>

        <div className="mb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Manage your editor, plan and account.</p>
        </div>

        <EditorPreferencesSettings />

        {/* Between the editor and Account, whose destructive delete row stays
            last. `canManage` is derived here rather than stored, since a copy of
            `stripeCustomerId !== null` can only ever disagree with it. The two
            counts are already fetched above for the delete confirmation, so the
            usage lines cost no extra query. */}
        <BillingSettings
          isPro={billing?.isPro ?? false}
          canManage={billing?.stripeCustomerId != null}
          itemCount={itemStats.total}
          collectionCount={collectionStats.total}
        />

        <AccountSettings
          email={user.email}
          hasPassword={user.hasPassword}
          itemCount={itemStats.total}
          collectionCount={collectionStats.total}
        />
      </div>
    </div>
  );
}
