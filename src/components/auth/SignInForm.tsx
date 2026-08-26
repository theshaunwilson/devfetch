'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signInWithCredentials, signInWithGitHub, type SignInState } from '@/actions/auth';
import { FieldError } from '@/components/auth/FieldError';
import { FormMessage } from '@/components/auth/FormMessage';
import { GitHubIcon } from '@/components/auth/GitHubIcon';
import { ResendVerification } from '@/components/auth/ResendVerification';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface SignInFormProps {
  callbackUrl: string;
  /** Error carried in on `?error=`, from an OAuth round-trip that failed. */
  initialError?: string;
  /** Set after `/register` redirects here. */
  justRegistered?: boolean;
  /** Set after `/verify-email` accepted a link. */
  justVerified?: boolean;
}

export function SignInForm({
  callbackUrl,
  initialError,
  justRegistered,
  justVerified,
}: SignInFormProps) {
  const [state, formAction] = useActionState<SignInState, FormData>(signInWithCredentials, {
    error: initialError,
  });

  // A banner from the previous page is stale the moment a submit comes back,
  // so the error takes the slot rather than stacking on top of it.
  const successBanner = state.error
    ? null
    : justVerified
      ? 'Email verified. Sign in to continue.'
      : justRegistered
        ? 'Account created. Check your email for the verification link, then sign in.'
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
          <Label htmlFor="password">Password</Label>
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

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground uppercase">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Its own form: a nested one is invalid, and this posts to a different action. */}
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <SubmitButton variant="outline" pendingLabel="Redirecting…" className="w-full">
          <GitHubIcon className="size-4" />
          Sign in with GitHub
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
