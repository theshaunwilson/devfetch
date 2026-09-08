'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { z } from 'zod';

import { resetPassword, type ResetPasswordState } from '@/actions/auth';
import { PasswordFields } from '@/components/auth/PasswordFields';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { FORGOT_PASSWORD_PATH } from '@/lib/auth-redirect';
import { resetPasswordSchema } from '@/lib/validation/auth';

interface ResetPasswordFormProps {
  /**
   * The plaintext token from the emailed link. The page has already checked
   * it is live; it rides through a hidden field so the submit can spend it.
   */
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(async (prevState, formData) => {
    // The same schema the action validates with, so a mismatch or an
    // over-long password is caught before the password crosses the wire.
    // `RegisterForm` does the same; the server still re-parses, since this
    // check is a convenience and not the authority.
    const parsed = resetPasswordSchema.safeParse({
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
    }

    // Redirects on success, which navigates away rather than returning.
    return resetPassword(prevState, formData);
  }, {});

  // The link died between the page rendering and the submit — spent in
  // another tab, or expired while the form sat open. Retyping cannot help, so
  // the form gives way to the one thing that can.
  if (state.linkDead) {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage>{state.error}</FormMessage>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        <PasswordFields
          passwordLabel="New password"
          confirmLabel="Confirm new password"
          fieldErrors={state.fieldErrors}
        />

        <SubmitButton pendingLabel="Updating…" className="mt-1 w-full">
          Update password
        </SubmitButton>
      </form>
    </div>
  );
}
