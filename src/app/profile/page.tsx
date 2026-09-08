import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { Button } from '@/components/ui/button';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/item-types';
import { getItemStats } from '@/lib/db/items';
import { getProfileUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'Profile · DevFetch',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [user, itemStats, collectionStats, itemTypes] = await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
    // Already returns every available type with its own item count, so the
    // breakdown needs no query of its own.
    getItemTypes(),
  ]);

  // The proxy already turns anonymous requests away; this catches the case it
  // cannot, a valid session whose user row is gone.
  if (!user) {
    redirect(`${SIGN_IN_PATH}?callbackUrl=%2Fprofile`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href={DEFAULT_SIGNED_IN_PATH}>
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>

      <ProfileHeader
        user={user}
        actions={
          <>
            {/* Only for accounts that sign in with a password. A GitHub
                account has none to change — `hasPassword` is derived from
                the column, never the column itself. */}
            {user.hasPassword && <ChangePasswordDialog />}

            <DeleteAccountDialog
              email={user.email}
              itemCount={itemStats.total}
              collectionCount={collectionStats.total}
            />
          </>
        }
      />

      <ProfileStats items={itemStats} collections={collectionStats} itemTypes={itemTypes} />
    </div>
  );
}
