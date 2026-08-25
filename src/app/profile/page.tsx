import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { UserAvatar } from '@/components/user/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { getCurrentUser } from '@/lib/db/user';
import { getDisplayName } from '@/lib/user';

export const metadata: Metadata = {
  title: 'Profile · DevFetch',
};

// Reads the session user per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  // The proxy already turns anonymous requests away; this catches the case it
  // cannot, a valid session whose user row is gone.
  if (!user) {
    redirect(`${SIGN_IN_PATH}?callbackUrl=%2Fprofile`);
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href={DEFAULT_SIGNED_IN_PATH}>
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>

        <CardContent className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />

          <div className="min-w-0">
            <p className="truncate font-medium">{getDisplayName(user)}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Editing your profile is not available yet.
      </p>
    </div>
  );
}
