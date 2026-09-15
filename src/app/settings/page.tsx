import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccountSettings } from '@/components/settings/AccountSettings';
import { Button } from '@/components/ui/button';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemStats } from '@/lib/db/items';
import { getProfileUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'Settings · DevFetch',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // The delete confirmation names what it is about to remove, so it needs
  // both totals; the profile page already runs exactly these three.
  const [user, itemStats, collectionStats] = await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
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

      <AccountSettings
        email={user.email}
        hasPassword={user.hasPassword}
        itemCount={itemStats.total}
        collectionCount={collectionStats.total}
      />
    </div>
  );
}
