import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getCollectionStats } from '@/lib/db/collections';
import { getItemStats, getItemTypes } from '@/lib/db/items';
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

      <ProfileHeader user={user} />

      <ProfileStats items={itemStats} collections={collectionStats} itemTypes={itemTypes} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* Only for accounts that sign in with a password. A GitHub account
              has none to change — `hasPassword` is derived from the column,
              never the column itself. */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Change password</h3>

            {user.hasPassword ? (
              <ChangePasswordForm />
            ) : (
              <p className="text-sm text-muted-foreground">
                You sign in with GitHub, so there is no password to change.
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-destructive">Delete account</h3>
            <p className="text-sm text-muted-foreground">
              Permanently deletes your account and everything in it. This cannot be undone.
            </p>

            <div className="mt-2">
              <DeleteAccountDialog
                email={user.email}
                itemCount={itemStats.total}
                collectionCount={collectionStats.total}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
