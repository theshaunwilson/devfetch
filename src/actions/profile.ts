'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { auth, signOut } from '@/auth';
import { hashPassword } from '@/lib/auth/password';
import { allScopedIdentifiers } from '@/lib/auth/token-scopes';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';
import { prisma } from '@/lib/prisma';
import { cancelLiveSubscriptions } from '@/lib/stripe-subscriptions';
import { changePasswordSchema, deleteAccountSchema } from '@/lib/validation/auth';

/**
 * The account behind the current session, or null.
 *
 * Every action here re-reads the session rather than trusting anything the
 * form sent: a server action is a public endpoint, so the id in the JWT is
 * the only thing that says whose account is being changed. The lookup, not
 * the token, decides — the JWT outlives the row it names.
 */
async function getSessionAccount() {
  const session = await auth();

  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, password: true, stripeCustomerId: true },
  });
}

export interface ChangePasswordState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Replaces the signed-in user's password.
 *
 * The current password is required even though the caller already holds a
 * session: sessions are JWTs with no revocation, so a stolen one could
 * otherwise silently replace the credential and lock the owner out.
 */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const user = await getSessionAccount();

    if (!user) {
      return { error: 'Your session has expired. Sign in again.' };
    }

    // Null for accounts created through GitHub. The form is not rendered for
    // them, but this is an exported server action and anyone can post to it —
    // so the guard lives here, not only in the component.
    if (!user.password) {
      return { error: 'This account signs in with GitHub and has no password to change.' };
    }

    const currentMatches = await bcrypt.compare(parsed.data.currentPassword, user.password);

    if (!currentMatches) {
      // Reported against the field it belongs to. Nothing is disclosed that
      // the caller does not already hold a session for.
      return { fieldErrors: { currentPassword: ['That is not your current password'] } };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(parsed.data.password) },
    });
  } catch (error) {
    console.error('Could not change the password:', error);

    return { error: 'Could not change your password. Please try again.' };
  }

  return { success: true };
}

export interface DeleteAccountState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Permanently deletes the signed-in user and everything they own, then signs
 * them out.
 *
 * Confirmed by typing the account's own email rather than its password, so
 * the one flow covers GitHub-only accounts too.
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({
    confirmEmail: formData.get('confirmEmail'),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const user = await getSessionAccount();

    if (!user) {
      return { error: 'Your session has expired. Sign in again.' };
    }

    // The address is checked against the session's own account, never used to
    // choose one — typing someone else's email deletes nothing.
    if (parsed.data.confirmEmail !== user.email.toLowerCase()) {
      return { fieldErrors: { confirmEmail: ['That does not match your email address'] } };
    }

    // Billing stops first, and the delete does not happen unless it did. Once
    // the row is gone nobody can reach Manage billing, so a subscription left
    // running would keep charging a card for an account that no longer exists
    // — refusing the delete is the only safe answer to a Stripe failure. An
    // account that never checked out has no customer and makes no call.
    if (user.stripeCustomerId) {
      try {
        await cancelLiveSubscriptions(user.stripeCustomerId);
      } catch (error) {
        console.error('Could not cancel the subscription before deleting the account:', error);

        return {
          error:
            'Could not cancel your subscription, so your account was not deleted. Please try again.',
        };
      }
    }

    const identifiers = allScopedIdentifiers(user.email);

    // Explicitly ordered rather than left to `onDelete: Cascade` from `User`,
    // the same ordering `scripts/prune-users.ts` uses. Deleting a user
    // cascades to both their items and their custom item types, but
    // `Item.type` is `onDelete: Restrict` — so if the database happened to
    // clear the item types first, the restrict would abort the whole delete.
    //
    // One transaction: a partial delete would leave orphaned content behind
    // with no user to find it from.
    await prisma.$transaction([
      // Cascades to the ItemTag join rows.
      prisma.item.deleteMany({ where: { userId: user.id } }),
      prisma.collection.deleteMany({ where: { userId: user.id } }),
      prisma.tag.deleteMany({ where: { userId: user.id } }),
      // Only their own types. The seeded system types have `userId: null`,
      // which never matches an equality filter, so those are left alone.
      prisma.itemType.deleteMany({ where: { userId: user.id } }),
      // `VerificationToken` has no foreign key to `User`, so nothing cascades
      // here — an unclicked link would outlive the account it was issued for.
      // Identifiers are scoped (`"<scope>:<email>"`), so the address is
      // expanded through the same helper the app writes with.
      prisma.verificationToken.deleteMany({ where: { identifier: { in: identifiers } } }),
      // Cascades to Account and Session.
      prisma.user.delete({ where: { id: user.id } }),
    ]);
  } catch (error) {
    console.error('Could not delete the account:', error);

    return { error: 'Could not delete your account. Please try again.' };
  }

  // Throws NEXT_REDIRECT, so nothing below runs — outside the try for exactly
  // that reason. The JWT still names the row that has just gone, so it is
  // dropped here rather than left to fail on the next request.
  await signOut({ redirectTo: SIGN_IN_PATH });

  return {};
}
