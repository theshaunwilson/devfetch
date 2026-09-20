# Stripe Phase 1 — Core Infrastructure

## Overview

Install Stripe and build the plumbing Pro billing needs: a lazily-built Stripe
client, the free-tier usage limits as pure logic, and the database readers and
writers for `isPro` / `stripeCustomerId` / `stripeSubscriptionId`.

**Nothing in this phase is user-visible and nothing calls Stripe's API yet.**
No webhook, no checkout, no UI, no gate. Phase 2 wires all of that up. The
point of stopping here is that every module below is unit-testable with no
network, no Stripe account and no CLI — and the build must still pass with the
Stripe variables unset.

Reference: `docs/stripe-integration-plan.md` (§1, §3.3, §4.1–4.4, §5.1–5.3).

## Requirements

- `npm install stripe`. Nothing else — hosted Checkout needs no `@stripe/stripe-js`
- **No migration.** `isPro`, `stripeCustomerId` and `stripeSubscriptionId` have
  been on `User` since `20260818212450_init`, both ids `@unique`
- Create `src/lib/stripe.ts` — lazy client + price id lookup
- Create `src/lib/usage-limits.ts` — free-tier ceilings and the limit check, pure
- Create `src/lib/db/billing.ts` — `isProUser`, `getBillingStatus`,
  `linkStripeCustomer`, `applySubscriptionState`
- Create `src/types/billing.ts` — `BillingInterval`, `BillingStatus`
- Rewrite the staged `.env.example` Stripe block and **drop `STRIPE_PUBLISHABLE_KEY`**
- Unit tests for all three new `src/lib` modules, co-located

## Files to Create

| File | Holds |
|---|---|
| `src/lib/stripe.ts` | `getStripe()`, `getPriceId(interval)` |
| `src/lib/usage-limits.ts` | `FREE_ITEM_LIMIT`, `FREE_COLLECTION_LIMIT`, `isWithinLimit`, `limitMessage` |
| `src/lib/db/billing.ts` | `isProUser`, `getBillingStatus`, `linkStripeCustomer`, `applySubscriptionState` |
| `src/types/billing.ts` | `BillingInterval`, `BillingStatus` |
| `src/lib/usage-limits.test.ts` | limits — see Testing |
| `src/lib/stripe.test.ts` | client and price id |
| `src/lib/db/billing.test.ts` | readers and the subscription write |

> The plan doc calls the limits module `src/lib/plan.ts` (§5.2). It ships as
> `usage-limits.ts` — `plan` reads as the marketing plan copy in
> `src/components/home/content.tsx`, which is a different thing.

## Usage Limits

| Kind | Free ceiling | Pro |
|---|---|---|
| Items | 50 | Unlimited |
| Collections | 3 | Unlimited |

- These numbers are **already advertised on `/`** (`src/components/home/content.tsx`),
  so they are a public promise and cannot be changed here alone
- Not a database column: which limits apply to which plan is a pricing decision,
  not a property of a row — the call `src/lib/pro.ts` and `src/lib/features.ts`
  both already make
- Pro is expressed as **the check not applying**, never as `Infinity`
- `limitMessage(kind)` names the number, so a refusal is actionable rather than
  just a refusal

## Notes

### `isPro` is read from the row, not from the session

`isProUser()` is its own `cache()`d query in `src/lib/db/billing.ts`, following
`getEditorPreferences`'s precedent — a separate keyed query rather than a column
added to `getCurrentUser()`, which the app shell runs on every request and whose
type `ProfileUser` extends.

**Do not add a `jwt` callback to put `isPro` in the token** (plan §4.2):

- `auth()` is called independently by `getCurrentUser`, `getProfileUser` and
  `getEditorPreferences`, each `cache()`d separately — so a `jwt` callback runs
  up to three times per request, not once
- Nothing on the client needs it; every gate in Phase 2 is server-side
- It contradicts `src/lib/db/user.ts`'s own stated rule — the lookup, not the
  token, decides. A cancelled subscription in a JWT keeps granting Pro until the
  token refreshes

The consequence is a feature, not a workaround: a plain page reload after
checkout picks up the new status, with no sign-out and no session refresh.

### The client is built lazily and the env is read at call time

`new Stripe(process.env.STRIPE_SECRET_KEY!)` at module scope would make
`next build` depend on the build machine holding the secret. Build it lazily and
cache it in a module-level variable, as `src/lib/rate-limit.ts` does, and read
both the key and the price ids at call time, as `src/lib/features.ts` requires.
(`src/lib/email/client.ts` already learned the adjacent lesson: `new Resend(undefined)`
throws at construction.)

Omit `apiVersion`. It defaults to the version the installed SDK's types describe;
pinning a different literal makes the types lie.

### `applySubscriptionState` uses `updateMany`, and sets absolute values

- Keyed on `stripeCustomerId`, which is `@unique`, so it can match at most one row
- `updateMany` rather than `update` so an unknown customer is a count of `0`
  rather than a thrown P2025 — Phase 2's webhook must log and acknowledge that,
  never retry it forever
- **Absolute, never relative.** Setting `isPro` to the same value twice is a
  no-op, and that is exactly what makes the webhook safe to retry with no dedupe
  table. Say so in the doc comment so nobody "fixes" it into a toggle later

### Deliberately unused until Phase 2

`linkStripeCustomer`, `getBillingStatus`, `getPriceId` and `src/types/billing.ts`
have no caller at the end of this phase. That is the phase boundary, not an
oversight — they are tested here and consumed by `src/actions/billing.ts` in
Phase 2.

## Environment Variables

```
# Stripe. Test-mode keys from dashboard.stripe.com/test/apikeys.
STRIPE_SECRET_KEY=""

# Signing secret for POST /api/stripe/webhook (Phase 2). In development this is
# printed by `stripe listen` and differs from the one the Dashboard shows for a
# deployed endpoint — they are not interchangeable.
STRIPE_WEBHOOK_SECRET=""

# The two recurring prices on the DevFetch Pro product.
STRIPE_PRICE_ID_MONTHLY=""
STRIPE_PRICE_ID_YEARLY=""
```

`STRIPE_PUBLISHABLE_KEY` is currently staged in `.env.example` and must be
removed: it is only used by Stripe.js in the browser, which the hosted-Checkout
redirect never loads, and it could not reach the client without a `NEXT_PUBLIC_`
prefix anyway. A template variable nothing reads sends the next reader hunting
for code that does not exist.

## Testing

Vitest, `environment: 'node'`, co-located `.ts` (never `.tsx`), no globals. Mock
the module boundary (`@/auth`, `@/lib/prisma`) and leave pure modules real.
Baseline before this phase: **706 tests across 33 files**.

### `src/lib/usage-limits.test.ts`

- Items: 49 → allowed, 50 → refused, 51 → refused
- Collections: 2 → allowed, 3 → refused, 4 → refused
- Pro allowed at every count, including 0 and 10,000
- `limitMessage('items')` names 50; `limitMessage('collections')` names 3
- The two exported constants match the numbers advertised in
  `src/components/home/content.tsx`, so the copy and the gate cannot drift

### `src/lib/stripe.test.ts`

- `getStripe()` throws with `STRIPE_SECRET_KEY` unset
- A second env stub flips the answer, proving the read is at call time and not
  captured on import
- `getPriceId` returns the right variable per interval and throws when unset

### `src/lib/db/billing.test.ts`

- `isProUser()` returns `false` with no session **and issues no query**
- `isProUser()` returns `false` when the row is gone (the JWT outlives the row)
- `applySubscriptionState` filters on `stripeCustomerId`, not `id`
- `applySubscriptionState` returns `false` when `count` is 0

### Mutations (prove the tests discriminate)

Restore sources from **file backups, never `git checkout`** — this project has
lost uncommitted work to that once. Abort rather than report a pass if a
pattern does not match.

- [ ] Drop the Pro bypass from `isWithinLimit` → red
- [ ] `<` → `<=` in the limit check → red
- [ ] `limitMessage` returns one message for both kinds → red
- [ ] `getStripe` reads the key at module scope → red
- [ ] `applySubscriptionState` keyed on `id` instead of `stripeCustomerId` → red
- [ ] `isProUser` trusts the session id without the lookup → red

### Gates

- [ ] `npm run test`
- [ ] Suite green under `env -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET` —
      nothing reaches Stripe
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit` — this project has repeatedly caught typed-Prisma-mock
      failures that lint and a green suite both missed
- [ ] `npm run build` **with every Stripe variable unset**, which is what proves
      the lazy client
- [ ] `npm run db:test`

## References

- `docs/stripe-integration-plan.md` — §1 current state, §4.1–4.4 decisions, §5.1–5.3 code
- Lazy-client precedent: `src/lib/rate-limit.ts`
- Call-time env precedent: `src/lib/features.ts`
- Separate-keyed-query precedent: `getEditorPreferences` in `src/lib/db/user.ts`
- Stripe Node SDK: Context7 `/stripe/stripe-node`
