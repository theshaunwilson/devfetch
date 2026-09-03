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

/**
 * Item type names are stored lowercase ("snippet"); the UI shows them
 * capitalized.
 */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
