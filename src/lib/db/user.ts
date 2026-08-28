// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { CurrentUser, ProfileUser } from '@/types/user';

/**
 * The signed-in user's profile, or null when nobody is signed in. Cached so
 * the dashboard resolves the user once per request however many callers ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // The JWT outlives the row it names — a deleted account still presents a
  // valid session — so the lookup, not the token, is what decides.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true },
  });

  return user;
});

/**
 * The current user's id. Reads through `getCurrentUser` rather than running
 * its own query, so the two share the one cached lookup.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();

  return user?.id ?? null;
}

/**
 * The signed-in user with the extra fields the profile page renders.
 *
 * A separate query rather than a widened `getCurrentUser`, so the sidebar —
 * which runs on every dashboard request — keeps selecting only the four
 * columns it draws. `password` is read but never returned: only whether one
 * exists leaves this function.
 */
export const getProfileUser = cache(async (): Promise<ProfileUser | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      password: true,
    },
  });

  if (!user) {
    return null;
  }

  const { password, createdAt, ...rest } = user;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    // The hash stops here. Only the boolean crosses to the client, where it
    // decides whether the change-password form renders at all.
    hasPassword: password !== null,
  };
});
