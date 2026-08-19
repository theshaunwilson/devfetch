import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/types/user';

// No auth yet, so the dashboard reads the seeded demo user. Replaced by the
// session user once NextAuth is wired up.
const DEMO_USER_EMAIL = 'demo@devfetch.io';

/** Cached per request so parallel dashboard queries share one lookup. */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  return user?.id ?? null;
});

/**
 * The current user's profile. Cached alongside `getCurrentUserId` so the
 * dashboard resolves the user once per request however many callers ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true, name: true, email: true, image: true },
  });

  return user;
});
