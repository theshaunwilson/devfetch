import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/item-types';
import { getItemStats } from '@/lib/db/items';
import { isProUser } from '@/lib/db/billing';
import { getProfileUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'Profile',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [user, itemStats, collectionStats, itemTypes, isPro] = await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
    // Already returns every available type with its own item count, so the
    // breakdown needs no query of its own.
    getItemTypes(),
    // Request-cached, so this shares the lookup the app shell already made.
    isProUser(),
  ]);

  // The proxy already turns anonymous requests away; this catches the case it
  // cannot, a valid session whose user row is gone.
  if (!user) {
    redirect(`${SIGN_IN_PATH}?callbackUrl=%2Fprofile`);
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-muted-foreground">Your account and what you have stashed.</p>
        </div>

        <ProfileHeader user={user} isPro={isPro} />

        <ProfileStats items={itemStats} collections={collectionStats} itemTypes={itemTypes} />
      </div>
    </div>
  );
}
