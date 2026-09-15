'use client';

import { useActionState } from 'react';
import { z } from 'zod';

import { changePassword, type ChangePasswordState } from '@/actions/profile';
import { FieldError } from '@/components/auth/FieldError';
import { PasswordFields } from '@/components/auth/PasswordFields';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePasswordSchema } from '@/lib/validation/auth';

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    async (prevState, formData) => {
      // The same schema the action validates with, so a mismatch or an
      // over-long password is caught before either password crosses the wire.
      // The server still re-parses — this check is a convenience, not the
      // authority.
      const parsed = changePasswordSchema.safeParse({
        currentPassword: formData.get('currentPassword'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
      });

      if (!parsed.success) {
        return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
      }

      return changePassword(prevState, formData);
    },
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      {state.success && (
        <FormMessage variant="success">
          Password changed. You are still signed in everywhere you were before.
        </FormMessage>
      )}

      {/* React resets an uncontrolled form once its action resolves, which
          clears all three fields. That is the wanted behaviour here — unlike
          sign-in, every field is a secret, so none is echoed back. */}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.currentPassword)}
            aria-describedby={state.fieldErrors?.currentPassword ? 'current-error' : undefined}
          />
          <FieldError id="current-error" messages={state.fieldErrors?.currentPassword} />
        </div>

        <PasswordFields
          passwordLabel="New password"
          confirmLabel="Confirm new password"
          passwordId="newPassword"
          confirmId="confirmNewPassword"
          fieldErrors={state.fieldErrors}
        />

        <SubmitButton pendingLabel="Updating…" className="mt-1 self-start">
          Change password
        </SubmitButton>
      </form>
    </div>
  );
}
