const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Short card date, e.g. "Jan 15". Fixed to UTC so server and client agree. */
export function formatShortDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}
