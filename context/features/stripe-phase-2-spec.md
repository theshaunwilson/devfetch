# Stripe Phase 2 — Integration & UI

## Overview

Make Pro sellable and enforceable: the webhook that keeps `isPro` in sync, the
checkout and billing-portal actions, the billing card on `/settings`, the
free-tier gates on item create / collection create / uploads, and the pricing
CTA routing on `/`.

This is the phase that changes behaviour for existing accounts. It cannot be
verified without a Stripe account, `stripe listen` and a real test checkout.

Depends on **Stripe Phase 1** (`context/features/stripe-phase-1-spec.md`), whose
modules every step below consumes.

Reference: `docs/stripe-integration-plan.md` (§2, §4.5–4.7, §5.4–5.7, §6, §7, §8).

## Prerequisites — Stripe Dashboard, test mode

1. **Product** — `DevFetch Pro`
2. **Prices** — two recurring prices on **one** product (that is what lets the
   portal offer a switch between them): `$8.00/month` → `STRIPE_PRICE_ID_MONTHLY`,
   `$72.00/year` → `STRIPE_PRICE_ID_YEARLY`
3. **API key** — the secret key (`sk_test_...`) → `STRIPE_SECRET_KEY`
4. **Billing portal** — Settings → Billing → Customer portal. Enable cancel,
   update payment method, switch plan (both prices on the allowed list) and
   invoice history
5. **Webhook, development** — `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
   The `whsec_...` it prints goes in `.env` and is **not** the same secret a
   Dashboard endpoint shows
6. **Webhook, production** — an endpoint at `/api/stripe/webhook` subscribed to
   exactly four events: `checkout.session.completed`,
   `customer.subscription.created`, `.updated`, `.deleted`. Never "all events"

## Requirements

Build in this order — each step leaves the app working.

### 1. Webhook, before anything can sell

- `src/app/api/stripe/webhook/route.ts`
- If checkout ships first, the first real payment has nothing listening and a
  paying customer is never upgraded

### 2. Selling

- `src/actions/billing.ts` — `startCheckout(interval)`, `openBillingPortal()`
- `src/components/settings/BillingSettings.tsx`, wired into
  `src/app/settings/page.tsx` **above** Editor preferences (Account, with its
  destructive delete row, stays last)

### 3. Enforcing

- Item limit in `createItem` (`src/lib/db/items.ts`) + `src/actions/items.ts`
- Collection limit in `createCollection` (`src/lib/db/collections.ts`) +
  `src/actions/collections.ts`
- Upload gate in `POST /api/uploads` **and** in `createItem`'s `required.file` branch
- `src/components/items/NewItemDialog.tsx` — show File and Image as Pro-gated for
  free accounts, and drop the "gating lands with billing" comments there and in
  `src/lib/pro.ts`

### 4. The funnel

- `src/components/home/PlanCard.tsx` — CTA by plan and sign-in state

## Webhook

| Event | Effect |
|---|---|
| `checkout.session.completed` | `mode === 'subscription'` only → set Pro, store subscription id |
| `customer.subscription.created` / `.updated` / `.deleted` | Derive from `subscription.status` |
| anything else | 200, no work |

- **The one route in the app not authenticated by session** — it is called by
  Stripe, so the signature authenticates it. `src/proxy.ts` does not match
  `/api`, so nothing stands in front of it
- **Raw body required**: `constructEvent` verifies an HMAC over the exact bytes
  Stripe sent, so `request.json()` re-serialises and fails every time. Use
  `request.text()`
- **Never infer state from which event arrived.** Stripe does not guarantee
  ordering — read `subscription.status` off the event object. Active statuses
  are `active` and `trialing`; `past_due`, `unpaid` and `canceled` are not
- Ordering guard: only clear `stripeSubscriptionId` when the id in the event
  matches the id on the row, so a stale `deleted` cannot kill a newer subscription
- Idempotency needs no dedupe table, because Phase 1's `applySubscriptionState`
  sets absolute values. Say so in a comment

| Condition | Response |
|---|---|
| `STRIPE_WEBHOOK_SECRET` unset | 500 + log — never a silent accept |
| Missing `stripe-signature` | 400 |
| Bad signature | 400, logged, never echoed in detail |
| Unknown customer id | 200 + log — a retry loop would never resolve |
| Handler threw | 500, so Stripe retries — safe, the handlers are idempotent |

## Checkout and Portal

- **Lazy customer creation** — create the Stripe customer on the first checkout
  attempt, not at registration. A free user who never upgrades leaves no trace
  in Stripe, and registration should not depend on a third-party call that can fail
- Set `metadata.userId` on the customer **and** on `subscription_data.metadata`,
  so a webhook can name its user if the row write ever failed after the customer
  was created
- Already Pro → refuse; the portal is the right door, not a second checkout
- `success_url` / `cancel_url` / `return_url` must come from `absoluteUrl()`, not
  the request's `Host` header, which a caller controls — the reason the
  verification emails use it. Land on `/settings?checkout=success|cancelled`
- **`redirect()` goes outside the `try`.** It works by throwing `NEXT_REDIRECT`;
  inside the `try` the `catch` swallows it and reports a generic failure while
  the user stays put
- `startCheckout` only ever *returns* on failure — success is a redirect — so its
  result type has no success arm

## Feature Gating

| Limit | Enforcement point |
|---|---|
| 50 items | `createItem` in `src/lib/db/items.ts`, inside the write's transaction |
| 3 collections | `createCollection` in `src/lib/db/collections.ts`, same |
| Uploads | `POST /api/uploads` **and** `createItem`'s `required.file` branch |

- Count **inside** the same `prisma.$transaction` as the create. Two concurrent
  requests at 49 items can otherwise both pass and land on 51. This narrows the
  window rather than closing it — closing it needs `SELECT ... FOR UPDATE` on the
  user row, which would serialise every create for the sake of a user briefly
  holding 51 items. **State the residual in the doc comment; do not pretend the
  check is exact**
- Report it as a tagged outcome, `reason: 'limit-reached'`, which is one new
  member of the existing `CreateCollectionOutcome` union. `createItem` currently
  returns `ItemDetail | null` and widens to the same shape — a convergence, not
  a divergence
- The upload path genuinely needs both doors: `/api/uploads` is where the R2
  spend happens, `createItem` writes the row that references it
- Upload refusal is **403, not 402** — the request is understood and the caller
  authenticated, they are simply not permitted. 402 is still reserved and
  inconsistently handled
- `/api/uploads` already runs its own `getCurrentUserId()` check; the Pro check
  drops in immediately after it

### Gate creation, never reading

File and Image have been offered to every account since uploads shipped, so free
users may **already own uploads**. `GET /api/files/[id]` must keep serving them.
Anything else looks like data loss on gate day.

### Downgrade policy: read-only overage

A Pro user with 200 items who cancels keeps all 200, visible and editable; only
*new* creates are refused until they are under the ceiling. This falls out of
gating creates alone — nothing else changes. Hard-locking the app is punitive
and deleting overage is never an option.

## UI

### `BillingSettings` (`/settings`)

Follows `AccountSettings`: `Card` → `CardHeader` → `CardContent className="divide-y"`
→ `SettingsRow`, a server component with a client child holding the buttons.

| State | Row | Action |
|---|---|---|
| Free | "DevFetch Pro", description naming both prices | Monthly / Yearly buttons → `startCheckout` |
| Pro | "DevFetch Pro", "Your subscription is active" | "Manage billing" → `openBillingPortal` |

- Both buttons need `useTransition` and a pending label, and **must not** be an
  `AlertDialogAction` or a `DropdownMenuItem` — both unmount on click and tear
  down the transition mid-request. This project has hit that trap three times
- `BillingStatus.canManage` is false for a Pro user with no `stripeCustomerId`
  (granted by hand), so they get no "Manage billing" button that would fail
- `/settings` already mounts its own `<Toaster />`, so the `?checkout=success`
  banner has somewhere to render

### `PlanCard` (`/`)

| Viewer | Pro CTA |
|---|---|
| Signed out | `/register` — unchanged; an account is needed to bill |
| Signed in, free | Start checkout |
| Signed in, Pro | `/settings` |

`/` is already `force-dynamic` and calls `getCurrentUser()`, so the signed-in
branch needs no new query. `BillingToggle` already holds the monthly/yearly
state — that is the `interval` checkout needs, so the plumbing exists. Thread
`isSignedIn` / `isPro` down `PricingSection` → `BillingToggle` → `PlanCard`.

### `NewItemDialog`

Show File and Image **disabled with an upgrade hint, not hidden** — a hidden
feature cannot be sold. `isProType` already identifies them; it needs the
viewer's plan alongside it.

## Testing

### Unit (`npm run test`)

- `startCheckout` refuses with no session, and refuses when already Pro
- `startCheckout` reuses an existing `stripeCustomerId` and creates one only when absent
- `startCheckout` sets `metadata.userId` on the customer **and** on `subscription_data`
- `createItem` refused at 50 for free, allowed at 49, allowed at 500 for Pro
- `createCollection` refused at 3 for free, allowed at 2
- Suite still green under `env -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET`

The webhook route itself gets no unit test — `coding-standards.md` scopes the
suite to server actions and utilities, which is why `/api/uploads` and
`/api/auth/register` have none either. Its branches are covered by the CLI run
below.

### Mutations

Restore from **file backups, never `git checkout`**.

- [ ] Webhook infers `isPro` from `event.type` rather than `subscription.status` → red
- [ ] Signature verification removed → red
- [ ] `startCheckout`'s session guard removed → red
- [ ] The limit check moved outside the transaction → red
- [ ] Upload gate removed from the route but kept in the action → red

### Webhook, against the Stripe CLI

With `stripe listen` running and the dev server up:

- [ ] `stripe trigger checkout.session.completed` → 200, handler reached
- [ ] A **real** test checkout with `4242 4242 4242 4242` → pay → land on
      `/settings?checkout=success`
- [ ] `User.isPro` true with both Stripe ids populated, read directly from the
      **development** Neon branch (`br-gentle-tooth-zavtxrsu`) — never production
- [ ] Replaying the same event changes nothing (idempotency)
- [ ] Tampered body → 400, `isPro` unchanged
- [ ] Missing `stripe-signature` → 400
- [ ] `STRIPE_WEBHOOK_SECRET` unset → 500 and a log line
- [ ] Event for a customer id no row holds → 200 with a log, not a retry loop
- [ ] Cancel via the portal → `isPro` false, `stripeSubscriptionId` null
- [ ] Payment failure → `past_due` → `isPro` false

### Gating, in a real browser

- [ ] Free at 49 items creates the 50th; the 51st is refused, message naming the limit
- [ ] Free at 3 collections is refused and the dialog **keeps the typed values**
      (the uncontrolled-form defect this project hit in Auth Phase 3)
- [ ] Free upload: `POST /api/uploads` → 403, and the New Item dialog shows
      File/Image as Pro
- [ ] A free account that **already owns** an upload can still view and download it
- [ ] Pro creates past 50 items and 3 collections, and uploads
- [ ] After checkout, a **plain page reload** shows Pro — no sign-out
- [ ] Downgrade: Pro with 60 items cancels → all 60 still visible and editable,
      the 61st refused
- [ ] Billing card in both states, pending states caught mid-flight with the
      button disabled
- [ ] Zero page overflow at 390 and 1440 on `/settings` and `/`
- [ ] Zero console errors or warnings

### Gates

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `npm run db:test`

## Notes

### Decisions to confirm before coding

1. **Downgrade** — read-only overage, as above. Confirm
2. **Trial** — none planned. If Pro should have one it is
   `subscription_data.trial_period_days`, and `trialing` already grants Pro
3. **`past_due` grace** — the plan drops Pro the moment a payment fails. A grace
   window needs the optional status column below to express
4. **Currency** — the marketing copy says `$` throughout; USD assumed
5. **Tax** — `automatic_tax: { enabled: true }` if Stripe Tax is configured. Not included

### Deliberately out of scope

- **AI, export and custom-type gates.** Nothing creates an `ItemType` row and
  neither AI nor export exists — each carries its Pro check when it is built.
  Gating a feature that does not exist writes dead code
- **`stripeSubscriptionStatus` / `stripeCurrentPeriodEnd`.** A second, purely
  additive migration. `isPro: boolean` cannot express "cancelled, still paid
  through the 28th" — add it when the billing card needs more than on/off
- **A `jwt` callback carrying `isPro`.** See Phase 1; add only if a client
  component genuinely needs it from `useSession()`
- **Live mode.** Repeat the Dashboard setup in live mode as a separate step; the
  ids all differ, and `APP_URL` must already point at the deployed origin or
  `success_url` sends paying customers to localhost

## References

- `docs/stripe-integration-plan.md` — §2 gating, §4.5–4.7, §5.4–5.7, §6, §7, §8
- Settings card pattern: `src/components/settings/AccountSettings.tsx`
- Tagged-outcome pattern: `src/types/collection.ts`
- Route-handler shape: `src/app/api/uploads/route.ts`
- Stripe docs: Context7 `/stripe/stripe-node`, `/stripe/stripe-cli`
