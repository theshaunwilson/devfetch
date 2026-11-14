/**
 * Colours for the HTML emails.
 *
 * Email clients ignore stylesheets and CSS variables, so these are copies of
 * the light-theme tokens in `src/app/globals.css` (`:root`), inlined by the
 * templates. Light because a client draws the message on its own white page.
 * `colors.test.ts` fails if a copy drifts from the stylesheet.
 */
export const EMAIL_COLORS = {
  /** `--foreground`: the heading and the default text colour. */
  text: '#101715',
  /** `--muted-foreground`: body copy and the small print. */
  muted: '#58675f',
  /** `--primary`: the call-to-action button. */
  button: '#3d7a0a',
  /** `--primary-foreground`: the button's label. */
  buttonText: '#ffffff',
} as const;
