/**
 * What a pricing card's button does, given who is looking at it.
 *
 * Pure on purpose — no React, no session, no Stripe — so the six combinations
 * are unit-testable, which is the whole reason this is not an inline ternary
 * in `PlanCard`. The same call `src/lib/usage-limits.ts` and
 * `src/lib/stripe-events.ts` make.
 *
 * The marketing page is the one place where the plan someone is already on has
 * to change what a button offers. Getting it wrong is not cosmetic: a signed-in
 * Pro user handed a checkout button opens a second subscription, and a
 * signed-out visitor handed one reaches an action that refuses them.
 */
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/auth-redirect';

const REGISTER_PATH = '/register';
const SETTINGS_PATH = '/settings';

/** Which of the two cards this is. `featured` says the same thing visually. */
export type PlanKind = 'free' | 'pro';

export interface PlanViewer {
  isSignedIn: boolean;
  isPro: boolean;
}

/**
 * A link, or the one button that starts checkout.
 *
 * Two arms rather than an optional `onClick`, so a caller cannot render a link
 * that also runs an action, or a button with nowhere to go.
 */
export type PlanCta =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'checkout'; label: string };

/**
 * `fallbackLabel` is the card's own copy from `content.tsx`, used wherever the
 * viewer's state does not call for something more specific — so the marketing
 * words stay in the data module rather than being restated here.
 */
export function planCta(
  plan: PlanKind,
  viewer: PlanViewer,
  fallbackLabel: string,
): PlanCta {
  if (plan === 'free') {
    // Signed in, the free card is not an offer — it is either the plan they
    // are on or one they are above. Either way `/register` would bounce them
    // straight back to the dashboard, so it points there directly.
    return viewer.isSignedIn
      ? { kind: 'link', label: 'Go to dashboard', href: DEFAULT_SIGNED_IN_PATH }
      : { kind: 'link', label: fallbackLabel, href: REGISTER_PATH };
  }

  // Already paying: the portal is the only thing left to offer, and it lives
  // behind the settings page rather than being opened from a public page.
  if (viewer.isPro) {
    return { kind: 'link', label: 'Manage your plan', href: SETTINGS_PATH };
  }

  // Signed in and free — the one case that can actually buy something here.
  if (viewer.isSignedIn) {
    return { kind: 'checkout', label: fallbackLabel };
  }

  // Signed out. Checkout needs an account to bill, so registration comes first.
  return { kind: 'link', label: fallbackLabel, href: REGISTER_PATH };
}
