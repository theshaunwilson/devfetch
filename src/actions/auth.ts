'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { signIn, signOut } from '@/auth';
import { SIGN_IN_PATH, safeCallbackUrl } from '@/lib/auth-redirect';
import { signInSchema } from '@/lib/validation/auth';

/**
 * One message for a wrong password, an unknown email and an OAuth-only
 * account alike — `authorize` already refuses to distinguish them.
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

export interface SignInState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Echoed back so the form can re-seed its input. React resets an
   * uncontrolled form once the action resolves, which would otherwise clear
   * the email on every failed attempt. The password is deliberately not
   * carried: it is short, and it would ride through the response payload.
   */
  email?: string;
}

export async function signInWithCredentials(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const submittedEmail = formData.get('email');
  // Kept as typed rather than normalized, so the field does not silently
  // rewrite itself under the user after a failed attempt.
  const email = typeof submittedEmail === 'string' ? submittedEmail : undefined;

  const parsed = signInSchema.safeParse({
    email: submittedEmail,
    password: formData.get('password'),
  });

  if (!parsed.success) {
    // Shape complaints only ("enter a valid email"); the schema deliberately
    // does not enforce the password policy here, so nothing is disclosed.
    return {
      error: INVALID_CREDENTIALS,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      email,
    };
  }

  try {
    await signIn('credentials', {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get('callbackUrl')),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: INVALID_CREDENTIALS, email };
    }

    // A successful sign-in throws NEXT_REDIRECT, which has to reach Next.
    throw error;
  }

  return {};
}

export async function signInWithGitHub(formData: FormData): Promise<void> {
  try {
    await signIn('github', { redirectTo: safeCallbackUrl(formData.get('callbackUrl')) });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`${SIGN_IN_PATH}?error=${error.type}`);
    }

    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
