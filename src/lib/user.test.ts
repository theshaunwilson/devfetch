import { describe, expect, it } from 'vitest';

import type { CurrentUser } from '@/types/user';

import { getDisplayName, getInitials } from './user';

const user = (overrides: Partial<CurrentUser> = {}): CurrentUser => ({
  id: 'user_1',
  name: 'Demo User',
  email: 'demo@devfetch.site',
  image: null,
  ...overrides,
});

describe('getDisplayName', () => {
  it('prefers the name', () => {
    expect(getDisplayName(user())).toBe('Demo User');
  });

  it('falls back to the email, since User.name is nullable', () => {
    expect(getDisplayName(user({ name: null }))).toBe('demo@devfetch.site');
  });
});

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials(user())).toBe('DU');
  });

  it('stops at two initials for a longer name', () => {
    expect(getInitials(user({ name: 'Ada Grace Byron King' }))).toBe('AG');
  });

  it('upper-cases a lower-case name', () => {
    expect(getInitials(user({ name: 'ada lovelace' }))).toBe('AL');
  });

  it('ignores stray double spaces rather than emitting an undefined initial', () => {
    expect(getInitials(user({ name: 'Ada  Lovelace' }))).toBe('AL');
    expect(getInitials(user({ name: '  Ada Lovelace  ' }))).toBe('AL');
  });

  it('uses the email s first letter when there is no name', () => {
    expect(getInitials(user({ name: null }))).toBe('D');
  });

  it('handles a single-word name', () => {
    expect(getInitials(user({ name: 'Prince' }))).toBe('P');
  });
});
