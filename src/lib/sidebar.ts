/**
 * The desktop sidebar's collapsed state, persisted in a cookie rather than
 * `localStorage` so the server can read it and render the right width on the
 * first paint. Storing it client-side would leave the sidebar rendering open
 * on every load and snapping shut once JavaScript ran.
 */

export const SIDEBAR_COOKIE = 'devfetch_sidebar';

/** A year: a layout preference should outlive the browsing session. */
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const COLLAPSED = 'collapsed';
const EXPANDED = 'expanded';

/**
 * Whether the sidebar should render open, given the cookie's raw value.
 *
 * Only the literal `collapsed` closes it, so a missing, cleared or corrupted
 * cookie falls back to open — the default the app has always had. Failing the
 * other way would hide the navigation on a value nobody set.
 */
export function isSidebarOpen(cookieValue: string | undefined): boolean {
  return cookieValue !== COLLAPSED;
}

/** The `document.cookie` assignment that records the current state. */
export function sidebarCookie(isOpen: boolean): string {
  const value = isOpen ? EXPANDED : COLLAPSED;

  return `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
}
