interface SettingsRowProps {
  title: string;
  description: string;
  action: React.ReactNode;
  /**
   * Makes the title the label for the control in `action`.
   *
   * Only for rows whose action is a single form control — a select or a
   * switch. Both render as a `<button>`, which is labelable, so this is what
   * gives them their accessible name and makes the title click to focus. A row
   * whose action is a dialog trigger leaves it off: that button names itself.
   */
  htmlFor?: string;
  /** Tints the heading for a destructive action, matching its button. */
  destructive?: boolean;
}

/**
 * One labelled setting. The text block carries `min-w-0` so a long word cannot
 * push the action out of the card, and the row stacks below `sm` so neither
 * half is squeezed narrower than its own content on a phone.
 *
 * Shared by the account and editor cards rather than written twice, so the two
 * cannot drift into looking like different kinds of thing.
 */
export function SettingsRow({
  title,
  description,
  action,
  htmlFor,
  destructive = false,
}: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h3 className={`text-sm font-medium ${destructive ? 'text-destructive' : ''}`}>
          {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="sm:shrink-0">{action}</div>
    </div>
  );
}
