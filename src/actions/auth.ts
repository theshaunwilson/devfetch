'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { signIn, signOut } from '@/auth';
import { EMAIL_NOT_VERIFIED_CODE, EMAIL_NOT_VERIFIED_MESSAGE } from '@/lib/auth-errors';
import { SIGN_IN_PATH, safeCallbackUrl } from '@/lib/auth-redirect';
import { sendVerificationEmail } from '@/lib/email/verification';
import { prisma } from '@/lib/prisma';
import { resendVerificationSchema, signInSchema } from '@/lib/validation/auth';

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
  /**
   * Set only when the password was correct but the address is unverified, so
   * the resend button appears for someone who has already proven the account
   * is theirs — never merely because an email was typed in.
   */
  canResend?: boolean;
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
      // Auth.js rethrows the error `authorize` threw, so the code survives.
      // Everything else stays deliberately indistinguishable.
      if ('code' in error && error.code === EMAIL_NOT_VERIFIED_CODE) {
        return { error: EMAIL_NOT_VERIFIED_MESSAGE, email, canResend: true };
      }

      return { error: INVALID_CREDENTIALS, email };
    }

    // A successful sign-in throws NEXT_REDIRECT, which has to reach Next.
    throw error;
  }

  return {};
}

export interface ResendState {
  sent?: boolean;
  error?: string;
}

/**
 * Sends a fresh verification link.
 *
 * The reply never varies: an unknown address, an already-verified account and
 * a real resend all return the same confirmation, so this cannot be used to
 * test whether an address is registered. A failed send is not reported either,
 * for the same reason — it is logged instead.
 */
export async function resendVerificationEmail(
  _prevState: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const parsed = resendVerificationSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { error: 'Enter a valid email address.' };
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    // Nothing to do for an unknown address or an account already verified —
    // and the caller is told the same thing either way.
    if (user && !user.emailVerified) {
      await sendVerificationEmail(email);
    }
  } catch (error) {
    console.error('Could not resend the verification email:', error);
  }

  return { sent: true };
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
