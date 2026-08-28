const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Short card date, e.g. "Jan 15". Fixed to UTC so server and client agree. */
export function formatShortDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Full date, e.g. "January 15, 2026". Fixed to UTC, like `formatShortDate`. */
export function formatLongDate(iso: string): string {
  return LONG_DATE_FORMATTER.format(new Date(iso));
}
