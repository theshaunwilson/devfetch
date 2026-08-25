import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { SignInForm } from '@/components/auth/SignInForm';
import { safeCallbackUrl } from '@/lib/auth-redirect';
import { signInErrorMessage } from '@/lib/auth-errors';

export const metadata: Metadata = {
  title: 'Sign in · DevFetch',
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string; registered?: string }>;
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
        initialError={signInErrorMessage(params.error)}
        justRegistered={params.registered === '1'}
      />
    </>
  );
}
