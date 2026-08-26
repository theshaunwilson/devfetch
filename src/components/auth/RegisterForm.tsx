'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { z } from 'zod';

import { FieldError } from '@/components/auth/FieldError';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_MIN_LENGTH, registerSchema } from '@/lib/validation/auth';

/** Mirrors the `{ success, data, error }` shape of `/api/auth/register`. */
interface RegisterResponseBody {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Echoed back so the fields survive a failed submit — React resets an
   * uncontrolled form once the action resolves. Passwords are left out and
   * have to be retyped.
   */
  values?: { name: string; email: string };
  /** Held after a 201 so the form stays disabled through the redirect. */
  created?: boolean;
}

export function RegisterForm() {
  const router = useRouter();

  const [state, formAction] = useActionState<RegisterState, FormData>(async (_prevState, formData) => {
    // As typed, not as normalized, so the fields do not rewrite themselves
    // under the user when the submit comes back with an error.
    const values = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
    };

    // The same schema the route validates with, so mismatched passwords and
    // an over-long one are caught before a request goes out.
    const parsed = registerSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
    }

    let response: Response;

    try {
      response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `confirmPassword` goes too: the route parses with the same schema.
        body: JSON.stringify(parsed.data),
      });
    } catch {
      return { error: 'Could not reach the server. Check your connection and try again.', values };
    }

    const body: RegisterResponseBody | null = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        error: body?.error ?? 'Could not create the account',
        fieldErrors: body?.fieldErrors,
        values,
      };
    }

    router.push('/sign-in?registered=1');

    return { created: true };
  }, {});

  return (
    <div className="flex flex-col gap-5">
      {state.error && <FormMessage>{state.error}</FormMessage>}
      {state.created && (
        <FormMessage variant="success">
          Account created. Check your email for the verification link…
        </FormMessage>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            defaultValue={state.values?.name}
            required
            aria-invalid={Boolean(state.fieldErrors?.name)}
            aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
          />
          <FieldError id="name-error" messages={state.fieldErrors?.name} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.values?.email}
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
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? 'password-error' : 'password-hint'}
          />
          {state.fieldErrors?.password ? (
            <FieldError id="password-error" messages={state.fieldErrors.password} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            aria-describedby={state.fieldErrors?.confirmPassword ? 'confirm-error' : undefined}
          />
          <FieldError id="confirm-error" messages={state.fieldErrors?.confirmPassword} />
        </div>

        <SubmitButton pendingLabel="Creating account…" disabled={state.created} className="mt-1 w-full">
          Create account
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
