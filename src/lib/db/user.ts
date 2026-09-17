// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences } from '@/lib/editor-preferences';
import { prisma } from '@/lib/prisma';
import type { EditorPreferences } from '@/types/editor';
import type { CurrentUser, ProfileUser } from '@/types/user';
import type { EditorPreferencesData } from '@/lib/validation/editor-preferences';

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

/**
 * The signed-in user's editor preferences, or the defaults for anyone without
 * a row to read.
 *
 * Its own query rather than a column added to `getCurrentUser`, which the app
 * shell already runs on every request. Widening that one would have been a
 * free column on a query that is happening anyway, but `ProfileUser` extends
 * `CurrentUser`, so the preferences would have followed into the profile and
 * settings pages' own user lookup as well — two types carrying a field
 * neither renders. One small keyed lookup is the cheaper thing to explain.
 *
 * `cache`d like the rest, so the shell and the settings page each resolve it
 * once however many components ask.
 */
export const getEditorPreferences = cache(async (): Promise<EditorPreferences> => {
  const session = await auth();

  if (!session?.user?.id) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { editorPreferences: true },
  });

  // Never null and never throws: this feeds the editor, and an unreadable
  // preference must cost the user their chosen font size, not the editor.
  return parseEditorPreferences(user?.editorPreferences);
});

/**
 * Replaces the signed-in user's editor preferences, returning false when
 * there is nobody to write them for.
 *
 * The whole object is written rather than merged into what is there: the
 * caller has already validated a complete set, and a merge would preserve
 * fields from an older shape that nothing can now clear.
 */
export async function saveEditorPreferences(
  preferences: EditorPreferencesData,
): Promise<boolean> {
  const userId = await getCurrentUserId();

  if (!userId) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { editorPreferences: preferences },
  });

  return true;
}
