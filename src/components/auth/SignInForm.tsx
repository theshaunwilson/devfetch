'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signInWithCredentials, type SignInState } from '@/actions/auth';
import { FieldError } from '@/components/auth/FieldError';
import { FormMessage } from '@/components/auth/FormMessage';
import { GitHubAuthSection } from '@/components/auth/GitHubAuthSection';
import { ResendVerification } from '@/components/auth/ResendVerification';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FORGOT_PASSWORD_PATH } from '@/lib/auth-redirect';

interface SignInFormProps {
  callbackUrl: string;
  /** Error carried in on `?error=`, from an OAuth round-trip that failed. */
  initialError?: string;
  /** Set after `/register` redirects here. */
  justRegistered?: boolean;
  /** Set after `/verify-email` accepted a link. */
  justVerified?: boolean;
  /** Set after a password reset landed back here. */
  justReset?: boolean;
  /**
   * From `isEmailVerificationEnabled()` on the server. `EMAIL_VERIFICATION` is
   * not a `NEXT_PUBLIC_` variable, so this component cannot read it itself.
   */
  verificationRequired: boolean;
}

export function SignInForm({
  callbackUrl,
  initialError,
  justRegistered,
  justVerified,
  justReset,
  verificationRequired,
}: SignInFormProps) {
  const [state, formAction] = useActionState<SignInState, FormData>(signInWithCredentials, {
    error: initialError,
  });

  // A banner from the previous page is stale the moment a submit comes back,
  // so the error takes the slot rather than stacking on top of it.
  const successBanner = state.error
    ? null
    : justReset
      ? 'Password updated. Sign in with your new password.'
      : justVerified
        ? 'Email verified. Sign in to continue.'
        : justRegistered
          ? verificationRequired
            ? 'Account created. Check your email for the verification link, then sign in.'
            : 'Account created. Sign in to continue.'
          : null;

  return (
    <div className="flex flex-col gap-5">
      {successBanner && <FormMessage variant="success">{successBanner}</FormMessage>}
      {state.error && <FormMessage>{state.error}</FormMessage>}
      {/* Only after a correct password met an unverified account. */}
      {state.canResend && state.email && <ResendVerification email={state.email} />}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            // Re-seeds the field: React resets the form once the action
            // resolves, so a failed attempt would otherwise blank it.
            defaultValue={state.email}
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          />
          <FieldError id="email-error" messages={state.fieldErrors?.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
          />
          <FieldError id="password-error" messages={state.fieldErrors?.password} />
        </div>

        <SubmitButton pendingLabel="Signing in…" className="mt-1 w-full">
          Sign in
        </SubmitButton>
      </form>

      <GitHubAuthSection callbackUrl={callbackUrl} label="Sign in with GitHub" />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
