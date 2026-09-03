import { describe, expect, it } from 'vitest';

import { isSidebarOpen, sidebarCookie, SIDEBAR_COOKIE } from './sidebar';

describe('isSidebarOpen', () => {
  it('collapses only on the literal value it writes', () => {
    expect(isSidebarOpen('collapsed')).toBe(false);
    expect(isSidebarOpen('expanded')).toBe(true);
  });

  it('falls back to open when the cookie is absent', () => {
    // A first visit, or a user who has cleared their cookies.
    expect(isSidebarOpen(undefined)).toBe(true);
  });

  it('falls back to open on a value nobody set', () => {
    // Failing the other way would hide the navigation on a corrupted cookie.
    for (const value of ['', 'true', 'false', 'Collapsed', ' collapsed ', '0']) {
      expect(isSidebarOpen(value)).toBe(true);
    }
  });
});

describe('sidebarCookie', () => {
  it('round-trips through isSidebarOpen in both directions', () => {
    const valueOf = (cookie: string) => cookie.split(';')[0].split('=')[1];

    expect(isSidebarOpen(valueOf(sidebarCookie(false)))).toBe(false);
    expect(isSidebarOpen(valueOf(sidebarCookie(true)))).toBe(true);
  });

  it('is scoped to the whole site, so it applies to every route', () => {
    expect(sidebarCookie(true)).toContain('path=/');
  });

  it('outlives the browsing session', () => {
    const maxAge = Number(/max-age=(\d+)/.exec(sidebarCookie(true))?.[1]);

    expect(maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
  });

  it('sets samesite so the cookie is not sent on cross-site requests', () => {
    expect(sidebarCookie(true)).toContain('samesite=lax');
  });

  it('writes the name the server reads', () => {
    expect(sidebarCookie(true).startsWith(`${SIDEBAR_COOKIE}=`)).toBe(true);
  });
});
