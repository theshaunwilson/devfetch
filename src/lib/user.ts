import type { CurrentUser } from '@/types/user';

/** Name is nullable in the schema, so unnamed users are shown by email. */
export function getDisplayName(user: CurrentUser): string {
  return user.name ?? user.email;
}

/**
 * Two-letter initials for the avatar fallback. Falls back to the email's
 * first letter rather than splitting a name that is not there.
 */
export function getInitials(user: CurrentUser): string {
  if (!user.name) return user.email.charAt(0).toUpperCase();

  return user.name
    .split(' ')
    // Stray double spaces would otherwise contribute an `undefined` initial.
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
