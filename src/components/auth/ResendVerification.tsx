'use client';

import { useActionState } from 'react';

import { resendVerificationEmail, type ResendState } from '@/actions/auth';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';

interface ResendVerificationProps {
  /** The address that was just refused for being unverified. */
  email: string;
}

/**
 * Its own form rather than a button inside the sign-in form: forms cannot
 * nest, and this posts to a different action.
 */
export function ResendVerification({ email }: ResendVerificationProps) {
  const [state, formAction] = useActionState<ResendState, FormData>(resendVerificationEmail, {});

  if (state.sent) {
    // Worded so it says the same thing whether or not anything was sent —
    // the action deliberately does not reveal which.
    return (
      <FormMessage variant="success">
        If that account still needs verifying, a new link is on its way. Check your inbox.
      </FormMessage>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <SubmitButton variant="outline" pendingLabel="Sending…" className="w-full">
        Resend verification email
      </SubmitButton>
    </form>
  );
}
