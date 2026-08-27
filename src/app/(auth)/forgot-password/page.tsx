import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password · DevFetch',
};

/**
 * Unlike `/sign-in` and `/register`, this does **not** bounce a signed-in
 * user to the dashboard. Someone signed in on one device asking for a link
 * they will open on another is an ordinary thing to do, and there is no
 * in-app way to change a password yet.
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <ForgotPasswordForm />
    </>
  );
}
