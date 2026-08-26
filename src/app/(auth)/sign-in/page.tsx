import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { SignInForm } from '@/components/auth/SignInForm';
import { safeCallbackUrl } from '@/lib/auth-redirect';
import { signInErrorMessage, verificationErrorMessage } from '@/lib/auth-errors';

export const metadata: Metadata = {
  title: 'Sign in · DevFetch',
};

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    registered?: string;
    /** Set by `/verify-email` after it accepted a link. */
    verified?: string;
    /** Set by `/verify-email` when it did not. */
    verifyError?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  // Nothing to do here signed in, and the proxy would bounce straight back.
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your DevFetch</p>
      </div>

      <SignInForm
        callbackUrl={callbackUrl}
        // Both land in the same banner slot; only one can be set at a time.
        initialError={signInErrorMessage(params.error) ?? verificationErrorMessage(params.verifyError)}
        justRegistered={params.registered === '1'}
        justVerified={params.verified === '1'}
      />
    </>
  );
}
