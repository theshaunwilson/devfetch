import { describe, expect, it } from 'vitest';

import { capitalize, formatLongDate, formatShortDate } from './format';

describe('formatShortDate', () => {
  it('formats an ISO timestamp as a short month and day', () => {
    expect(formatShortDate('2026-01-15T12:00:00.000Z')).toBe('Jan 15');
  });

  it('reads the date in UTC, not the running machine s zone', () => {
    // 23:30 UTC is still the 15th in UTC but the 16th east of it. Fixing the
    // formatter to UTC is what keeps a server render and a client render from
    // disagreeing, so it is the property worth pinning.
    expect(formatShortDate('2026-01-15T23:30:00.000Z')).toBe('Jan 15');
    expect(formatShortDate('2026-01-16T00:30:00.000Z')).toBe('Jan 16');
  });
});

describe('formatLongDate', () => {
  it('formats an ISO timestamp with the full month and year', () => {
    expect(formatLongDate('2026-01-15T12:00:00.000Z')).toBe('January 15, 2026');
  });

  it('reads the date in UTC', () => {
    expect(formatLongDate('2026-12-31T23:30:00.000Z')).toBe('December 31, 2026');
  });
});

describe('capitalize', () => {
  it('upper-cases the first letter and leaves the rest alone', () => {
    expect(capitalize('snippet')).toBe('Snippet');
  });

  it('does not lower-case anything it did not need to touch', () => {
    expect(capitalize('gitHub link')).toBe('GitHub link');
  });

  it('returns an empty string unchanged rather than throwing', () => {
    expect(capitalize('')).toBe('');
  });
});
