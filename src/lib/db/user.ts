// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/types/user';

// No auth yet, so the dashboard reads the seeded demo user. Replaced by the
// session user once NextAuth is wired up.
const DEMO_USER_EMAIL = 'demo@devfetch.io';

/**
 * The current user's profile. Cached so the dashboard resolves the user once
 * per request however many callers ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
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
