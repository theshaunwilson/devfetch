'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { RateLimitedError, signIn, signOut } from '@/auth';
import {
  consumePasswordResetToken,
  type PasswordResetResult,
} from '@/lib/auth/password-reset-token';
import {
  EMAIL_NOT_VERIFIED_CODE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  passwordResetErrorMessage,
} from '@/lib/auth-errors';
import { SIGN_IN_PATH, safeCallbackUrl } from '@/lib/auth-redirect';
import { sendPasswordResetEmail } from '@/lib/email/password-reset';
import { sendVerificationEmail } from '@/lib/email/verification';
import { isEmailVerificationEnabled } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { checkIpEmailRateLimit, checkIpRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import {
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
} from '@/lib/validation/auth';

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
      // Auth.js rethrows the error `authorize` threw, so the instance — and
      // with it the reset time — survives the trip back here.
      if (error instanceof RateLimitedError) {
        return { error: rateLimitMessage(error.reset), email };
      }

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

  // Nothing to resend when no link is ever issued. Unreachable from the UI in
  // that state — `canResend` is only set on the unverified branch, which
  // cannot fire — but this is an exported server action and anyone can post
  // to it. The reply is the same one every other outcome gets.
  if (!isEmailVerificationEnabled()) {
    return { sent: true };
  }

  // Keyed by address as well as IP, because the abuse this stops lands in
  // someone else's inbox: without the email in the key, one machine could
  // spread its budget across many addresses. Checked after the flag test so a
  // deployment with verification off spends no Upstash quota at all.
  const rateLimit = await checkIpEmailRateLimit('resendVerification', email);

  if (!rateLimit.success) {
    return { error: rateLimitMessage(rateLimit.reset) };
  }

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

export interface ForgotPasswordState {
  sent?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Echoed back so a rejected address survives React resetting the form. */
  email?: string;
}

/**
 * Emails a password reset link.
 *
 * The reply never varies: an unknown address, an account that signs in with
 * GitHub only and a real send all return the same confirmation, so this
 * cannot be used to test whether an address is registered. A failed send is
 * not reported either, for the same reason — it is logged instead.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const submittedEmail = formData.get('email');
  // Kept as typed rather than normalized, so the field does not silently
  // rewrite itself under the user after a rejected attempt.
  const email = typeof submittedEmail === 'string' ? submittedEmail : undefined;

  const parsed = forgotPasswordSchema.safeParse({ email: submittedEmail });

  if (!parsed.success) {
    return {
      error: 'Enter a valid email address.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      email,
    };
  }

  // After parsing, so a mistyped address does not spend the budget of the
  // person who then types it correctly. Everything expensive — the lookup,
  // the token, the send — sits behind this.
  const rateLimit = await checkIpRateLimit('forgotPassword');

  if (!rateLimit.success) {
    return { error: rateLimitMessage(rateLimit.reset), email };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { password: true },
    });

    // Only accounts that already have a password. An account created through
    // GitHub has none, and writing one off the back of inbox control alone
    // would hand it a second way in that its owner never asked for — they can
    // still sign in with GitHub. Told the same thing either way.
    if (user?.password) {
      await sendPasswordResetEmail(parsed.data.email);
    }
  } catch (error) {
    console.error('Could not send the password reset email:', error);
  }

  return { sent: true };
}

export interface ResetPasswordState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Set when the failure is the link rather than the input, so the form can
   * step aside for a way to request a new one. Retyping cannot help here.
   */
  linkDead?: boolean;
}

/**
 * Sets a new password against a reset token, then sends the user to sign in
 * with it — deliberately not signing them in here, so the new password is
 * exercised once before they rely on it.
 */
export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  // First, before the token is even looked at: submitting tokens is exactly
  // how this endpoint would be attacked, so a guess must cost a token from
  // the budget whether or not it parses. Legitimate users rarely reach here
  // more than once — the form parses client-side, so a mismatch never
  // becomes a request.
  const rateLimit = await checkIpRateLimit('resetPassword');

  if (!rateLimit.success) {
    return { error: rateLimitMessage(rateLimit.reset) };
  }

  const token = formData.get('token');

  if (typeof token !== 'string' || !token) {
    return { error: passwordResetErrorMessage('invalid'), linkDead: true };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let result: PasswordResetResult;

  try {
    result = await consumePasswordResetToken(token, parsed.data.password);
  } catch (error) {
    console.error('Could not reset the password:', error);

    return { error: 'Could not reset your password. Please try again.' };
  }

  if (result.status !== 'reset') {
    // The link was live when the page rendered and is not any more — spent in
    // another tab, or expired while the form sat open.
    return { error: passwordResetErrorMessage(result.status), linkDead: true };
  }

  // Throws NEXT_REDIRECT, so nothing below runs. Outside the try above for
  // exactly that reason.
  redirect(`${SIGN_IN_PATH}?reset=1`);
}
