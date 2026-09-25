import type { Metadata } from 'next';
import Link from 'next/link';

import { FormMessage } from '@/components/auth/FormMessage';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { checkPasswordResetToken } from '@/lib/auth/password-reset-token';
import { passwordResetErrorMessage } from '@/lib/auth-errors';
import { FORGOT_PASSWORD_PATH } from '@/lib/auth-redirect';

// Reads the query string and the database on every request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password',
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * The target of the link in the password reset email.
 *
 * The token is checked here but **not spent**, so a dead link is refused
 * before the user types anything, and a mail scanner that prefetches the link
 * cannot burn it. The password only changes on the submit that follows.
 *
 * A signed-in user is not redirected away: the link may well be opened on the
 * device that still has a live session.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const status = token ? await checkPasswordResetToken(token) : 'invalid';

  if (!token || status !== 'valid') {
    return (
      <>
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Link no longer works</h1>
        </div>

        <div className="flex flex-col gap-5">
          <FormMessage>{passwordResetErrorMessage(status)}</FormMessage>

          <p className="text-center text-sm text-muted-foreground">
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Request a new link
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll sign in with it next.</p>
      </div>

      <ResetPasswordForm token={token} />
    </>
  );
}
