import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/auth-redirect';
import { isEmailVerificationEnabled } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Create an account · DevFetch',
};

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user) {
    redirect(DEFAULT_SIGNED_IN_PATH);
  }

  return (
    <>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Store smarter. Build faster.</p>
      </div>

      <RegisterForm verificationRequired={isEmailVerificationEnabled()} />
    </>
  );
}
