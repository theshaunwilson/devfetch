/**
 * Fixed to UTC, like `lib/format.ts`, so the stamp does not depend on where
 * the server happens to run.
 */
const SENT_AT_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/**
 * Issuing a token deletes the one before it, so an inbox holding several of
 * these has exactly one working link and no way to tell which — the subject
 * and body are otherwise identical, and mail clients thread them together.
 * The timestamp is what makes the newest identifiable.
 *
 * `kind` names the email in the sentence, so the two senders share the rule
 * without sharing a wording that would be wrong in one of them.
 */
export function sentAtNote(sentAt: Date, kind: string): string {
  return `Sent ${SENT_AT_FORMATTER.format(sentAt)}. If you asked for more than one ${kind}, only the most recent link works.`;
}
