import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { EditorPreferencesProvider } from '@/components/editor/EditorPreferencesProvider';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { CheckoutBanner } from '@/components/settings/CheckoutBanner';
import { EditorPreferencesSettings } from '@/components/settings/EditorPreferencesSettings';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getBillingStatus } from '@/lib/db/billing';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemStats } from '@/lib/db/items';
import { getEditorPreferences, getProfileUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'Settings · DevFetch',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // The delete confirmation names what it is about to remove, so it needs
  // both totals; the profile page already runs exactly these three.
  const [user, itemStats, collectionStats, editorPreferences, billing] = await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
    // Read here rather than in the card: the card is a client component, and
    // this page renders outside `AppShell`, so it mounts its own provider.
    getEditorPreferences(),
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      {/* This page renders outside `AppShell`, which is the app's only other
          mount of this. Without it the editor preferences would save and
          confirm nothing at all — every settings component before this one
          reported itself with an inline banner, so nothing here had toasted
          before. The two are never mounted at once, so a toast cannot double. */}
      <Toaster position="bottom-right" />

      {/* Reads `?checkout=`, so it suspends — the page is `force-dynamic` and
          never prerendered, but `useSearchParams` wants the boundary either
          way. It renders nothing, so there is nothing to fall back to. */}
      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href={DEFAULT_SIGNED_IN_PATH}>
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account.</p>
      </div>

      {/* Above editor preferences, with Account and its destructive delete
          row last. `canManage` is derived here rather than stored, since a
          copy of `stripeCustomerId !== null` can only ever disagree with it. */}
      <BillingSettings
        isPro={billing?.isPro ?? false}
        canManage={billing?.stripeCustomerId != null}
      />

      <EditorPreferencesProvider preferences={editorPreferences}>
        <EditorPreferencesSettings />
      </EditorPreferencesProvider>

      <AccountSettings
        email={user.email}
        hasPassword={user.hasPassword}
        itemCount={itemStats.total}
        collectionCount={collectionStats.total}
      />
    </div>
  );
}
