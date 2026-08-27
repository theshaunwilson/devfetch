'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { requestPasswordReset, type ForgotPasswordState } from '@/actions/auth';
import { FieldError } from '@/components/auth/FieldError';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <div className="flex flex-col gap-5">
        {/* Worded so it says the same thing whether or not anything was sent —
            the action deliberately does not reveal which. */}
        <FormMessage variant="success">
          If an account uses that address, a reset link is on its way. It expires in one hour.
        </FormMessage>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={SIGN_IN_PATH}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            // Re-seeds the field: React resets the form once the action
            // resolves, so a rejected address would otherwise vanish.
            defaultValue={state.email}
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          />
          <FieldError id="email-error" messages={state.fieldErrors?.email} />
        </div>

        <SubmitButton pendingLabel="Sending…" className="mt-1 w-full">
          Send reset link
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          href={SIGN_IN_PATH}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
