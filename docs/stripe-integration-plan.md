# Stripe Integration Plan — DevFetch Pro

Research output. Documentation only; nothing in `src/` was modified to produce it.

Target: a Pro subscription at **$8/month** or **$72/year**, sold through Stripe
Checkout, kept in sync by webhooks, and enforced against the free tier's
**50 items / 3 collections** ceiling plus the Pro-only feature set.

---

## 1. Current state analysis

### 1.1 The schema is already there

`prisma/schema.prisma` has carried all three billing columns since the initial
migration (`20260818212450_init`):

```prisma
model User {
  isPro                Boolean @default(false)
  stripeCustomerId     String? @unique
  stripeSubscriptionId String? @unique
}
```

**No migration is required for the core integration.** Both Stripe ids are
`@unique`, which is worth keeping — it makes it impossible for two `User` rows
to claim the same Stripe customer, so a webhook resolving "which user is this?"
by `stripeCustomerId` can never match more than one row.

One optional migration is discussed in §4.6 (storing subscription status and
period end); it is not needed to ship.

### 1.2 `isPro` is read by nothing

Verified with `grep -rn "isPro" src --exclude-dir=generated`. The only hits are
`isProType` — an unrelated helper in `src/lib/pro.ts` about item *types* — plus
two test fixtures that use the string as junk input. Application code reads the
column **zero times**.

Likewise `grep -rni "stripe" src --exclude-dir=generated` returns nothing. There
is no existing payment, billing or subscription code of any kind.

`prisma/seed.ts:427` sets `isPro: false` on the demo user, and
`scripts/test-db.ts:94` prints it. That is the entire surface today.

### 1.3 The env vars are already staged (uncommitted)

`.env.example` is modified in the working tree and already ends with:

```
# Stripe
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_ID_MONTHLY=""
STRIPE_PRICE_ID_YEARLY=""
```

**`STRIPE_PUBLISHABLE_KEY` is not needed by the plan below** and should be
removed or left blank. It is only used by Stripe.js in the browser, which the
hosted-Checkout redirect approach never loads — and it could not reach the
client anyway without a `NEXT_PUBLIC_` prefix. Leaving a variable in the
template that nothing reads invites someone to hunt for the code that uses it.

### 1.4 Auth: how the session is built

`src/auth.ts` currently declares **only a `session` callback** and no `jwt`
callback at all:

```ts
callbacks: {
  session({ session, token }) {
    if (token.sub) {
      session.user.id = token.sub;
    }
    return session;
  },
},
```

It relies on `@auth/core` setting `token.sub` to the user id in its own default
callback handler. `session: { strategy: 'jwt' }` is mandatory here — the
Credentials provider requires it, and the Neon driver is not edge-safe.

The split config matters for Stripe in one specific way: `src/proxy.ts` builds
its **own** `NextAuth(authConfig)` instance from `src/auth.config.ts`, which
carries no callbacks and no adapter. So any callback added to `src/auth.ts`
does **not** run in the proxy path. That is load-bearing for §4.2.

`src/types/next-auth.d.ts` augments `Session` with `user.id` and nothing else.

### 1.5 How user data is actually accessed

This is the most important finding for the plan. `src/lib/db/user.ts` is the
single door, and it establishes a rule the codebase states explicitly:

> The JWT outlives the row it names — a deleted account still presents a valid
> session — so **the lookup, not the token, is what decides.**

Four `cache()`d readers live there:

| Function | Selects | Used by |
|---|---|---|
| `getCurrentUser()` | id, name, email, image | app shell / sidebar, every request |
| `getCurrentUserId()` | reads through `getCurrentUser` | every db write |
| `getProfileUser()` | + createdAt, hasPassword | `/profile`, `/settings` |
| `getEditorPreferences()` | editorPreferences only | editors, `/settings` |

`getEditorPreferences` is the precedent that matters: it is a **separate keyed
query rather than a column added to `getCurrentUser`**, and its doc comment
explains why — widening the shell's query would have dragged the field into
`ProfileUser` (which `extends CurrentUser`) as well, giving two types a field
neither renders. **`isPro` should follow exactly this pattern.**

Server actions resolve the caller with `await auth()` and then hand off to a
`src/lib/db/*` function that re-resolves via `getCurrentUserId()`. Ownership is
never taken from a payload.

---

## 2. Feature gating analysis

### 2.1 The free tier, as the product already advertises it

`src/components/home/content.tsx:135` — this copy is already shipped on `/`, so
the numbers below are a public promise, not a proposal:

```ts
export const FREE_PLAN: PlanCopy = {
  features: [
    '50 items',
    '3 collections',
    'Snippets, prompts, notes, commands and links',
    'Full-text search and the command palette',
    'Markdown and code editors',
  ],
};

export const PRO_PLAN: PlanCopy = {
  features: [
    'Unlimited items and collections',
    'File and image uploads',
    'Custom item types',
    'AI tagging, summaries, explanations and prompt tuning',
    'Export to JSON or ZIP',
  ],
};
```

`PRO_BILLING` already carries both price points (`$8` monthly / `$6` per month
billed as `$72` yearly), and `BillingToggle` already switches between them. The
pricing UI is done; only the CTA target changes.

### 2.2 Where counts are checked today: nowhere — but the queries exist

There is no limit enforcement anywhere. Two queries already return exactly the
numbers a check needs, and both are already `Promise.all`'d into `/settings`:

```ts
// src/lib/db/items.ts:676
export async function getItemStats(): Promise<ItemStats> {
  const userId = await getCurrentUserId();
  if (!userId) return { total: 0, favorites: 0 };
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);
  return { total, favorites };
}

// src/lib/db/collections.ts:356 — identical shape for collections
```

These are fine for *display*, but a gate should not reuse them: they run two
counts when one is needed, and the gate wants the count inside the same
transaction as the write (§4.4).

### 2.3 The exact enforcement points

There are precisely **three** places a free-tier limit can be crossed, and all
three are server actions or route handlers, so all three are enforceable:

| Limit | Enforcement point | Notes |
|---|---|---|
| 50 items | `createItem` in `src/actions/items.ts:71` | after the session check, before `createItemRow` |
| 3 collections | `createCollection` in `src/actions/collections.ts` | same position |
| File/image uploads | `POST /api/uploads` **and** `createItem`'s `required.file` branch | two doors, both need the check |

The upload path genuinely needs both: `/api/uploads` stores the object in R2
(that is the spend), and `createItem` writes the row that references it. Gating
only the action would let someone fill the bucket; gating only the route would
be fine today but breaks the moment a second caller appears.

`src/app/api/uploads/route.ts` already does its own `getCurrentUserId()` auth
check — the comment there explains that `src/proxy.ts` deliberately does not
match `/api`, so a proxy redirect would be parsed as JSON by a `fetch`. A Pro
check drops in immediately after that existing check.

### 2.4 The Pro features that need no gate

- **Custom item types** — nothing in the app creates an `ItemType` row. The
  seven system types come from `prisma/seed.ts`. There is no feature to gate.
- **AI (tagging, summaries, explain, prompt tuning)** — entirely unbuilt.
- **Export (JSON / ZIP)** — entirely unbuilt.

Each of these should carry the Pro check *when it is built*, not now. Adding a
gate to a feature that does not exist writes dead code.

### 2.5 The pre-existing state that a gate would break

Two things in the codebase say, in comments, that gating is deferred to billing:

`src/lib/pro.ts`:
> Free accounts can still browse them, so this is only used to mark the types
> in the UI — **gating lands with billing.**

`src/components/items/NewItemDialog.tsx:88`:
> Every type is offered. File and Image were held back only because uploads did
> not exist; `isProType` still marks them in the sidebar, and **enforcing that
> marking is a job for billing, which does not exist either.**

So File and Image are currently offered to every account, and free users may
already own uploads. **Turning the gate on must not break existing rows.**
`GET /api/files/[id]` should keep serving files a free user already has —
gate *creation*, never *reading*. Anything else would look like data loss.

### 2.6 Settings page structure

`src/app/settings/page.tsx` renders **outside `AppShell`** as a centred
`max-w-3xl` column with a "Back to dashboard" button. It mounts its own
`<Toaster />` (the comment notes `AppShell` is the app's only other mount, and
the two are never mounted at once). It already runs three queries in a
`Promise.all` and guards a null user with a redirect.

The card pattern is `Card` → `CardHeader` (title + description) →
`CardContent className="divide-y"` → one `SettingsRow` per row, where
`SettingsRow` takes `title`, `description`, an `action` node, and an optional
`destructive` flag. `AccountSettings` is the model to copy for a new
`BillingSettings` card.

Ordering on the page: Editor preferences, then Account. Billing should sit
**first**, above Editor preferences — it is the plan-level fact about the
account, and Account (with its destructive delete row) stays last.

---

## 3. API, action and environment patterns to follow

### 3.1 Route handlers

Both existing routes (`/api/uploads`, `/api/items/[id]`) follow one shape:

```ts
export async function POST(request: Request): Promise<NextResponse<XResponse>> {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Not signed in', 401);
  // ...
  try { /* work */ } catch (error) {
    console.error('Human sentence:', error);
    return fail('User-facing sentence. Please try again.', 500);
  }
}
```

- `{ success, data }` / `{ success, error }`, with the union typed in `src/types/`.
- Own auth check; never rely on the proxy for `/api`.
- Nothing from the client is trusted for identity.

The webhook route is the one deliberate exception: it is called by Stripe, not
by a signed-in user, so it authenticates by **signature** instead.

### 3.2 Server actions

From `src/actions/collections.ts` and `src/actions/items.ts`:

1. `const session = await auth();` → `{ success: false, error: 'Your session has expired. Sign in again.' }`
2. `schema.safeParse(data)` → `fieldErrors: z.flattenError(parsed.error).fieldErrors`
3. Delegate to a `src/lib/db/*` function that returns a **tagged outcome**
   (`{ ok: true, ... } | { ok: false, reason: '...' }`) — Prisma error codes are
   handled where the Prisma call is, never sniffed in the action.
4. `try/catch` → `console.error` + a generic user-facing sentence.

A new failure mode gets its own `reason`, which is exactly how the limit gate
should report itself (`reason: 'limit-reached'`).

### 3.3 Environment variables

`src/lib/features.ts` and `src/lib/rate-limit.ts` both state the rule, and it is
non-negotiable for Stripe too:

> Read at call time, never at module scope: a value captured on import would be
> the one present during `next build`.

`src/lib/rate-limit.ts` goes further and builds its client **lazily**, caching
it in a module-level variable, because `Redis.fromEnv()` does not throw on
missing config. The Stripe client must do the same — `new Stripe(undefined!)`
at module scope would make `next build` depend on the secret key being present
on the build machine. (`src/lib/email/client.ts` already learned this lesson:
`new Resend(undefined)` throws at construction.)

`src/lib/app-url.ts` supplies the absolute base for anything leaving the app,
deliberately from `APP_URL` rather than the request's `Host` header. Checkout
`success_url` / `cancel_url` and the portal's `return_url` **must** use
`absoluteUrl()` for the same reason.

### 3.4 Testing conventions

From `context/coding-standards.md`: Vitest, `environment: 'node'`, include glob
`src/**/*.test.ts` (never `.tsx`), co-located, no globals, **server actions and
utilities only — no component tests**. Mock the module boundary (`@/auth`,
`@/lib/prisma`, `@/lib/rate-limit`) and leave pure modules (Zod schemas) real.

Current baseline: **706 tests across 33 files**.

---

## 4. Design decisions that need settling before coding

These are the points where the obvious implementation is not the right one.

### 4.1 Lazy customer creation, not eager

Do **not** create a Stripe customer at registration. Create it on the first
checkout attempt and persist `stripeCustomerId` then. A free user who never
upgrades should leave no trace in the Stripe dashboard, and registration is
already rate-limited and email-sensitive without adding a third-party call that
can fail.

### 4.2 `isPro` in the session — a recommendation against the prompt's note

**The research prompt proposes adding a `jwt` callback that queries Prisma on
every session validation.** That works, but it is the wrong shape for this
codebase, for three measurable reasons:

1. **It is not one query per request.** `auth()` is called independently by
   `getCurrentUser`, `getProfileUser` and `getEditorPreferences` — each is
   `cache()`d separately, so `auth()` (and therefore the `jwt` callback) can run
   up to three times per request. `cache()` de-dupes each *function*, not the
   `auth()` call inside them. The note's "one small DB query per session
   validation" is really up to three extra `findUnique`s per request, on every
   authenticated page load, forever.
2. **Nothing on the client needs it.** Every gate identified in §2.3 is
   server-side. The only client-side use is cosmetic (a "Pro" badge, an upgrade
   button), and a server component can pass that down as a prop — which is
   already how `SidebarUser`, `AccountSettings` and `EditorPreferencesProvider`
   all receive their data.
3. **It contradicts the codebase's own stated rule.** `src/lib/db/user.ts` says
   the lookup decides, not the token. Putting a mutable billing flag in a JWT
   creates a second source of truth that is stale by construction — a cancelled
   subscription would keep granting Pro until the token refreshes.

**Recommended instead:** a `getProStatus()` reader in `src/lib/db/user.ts`,
`cache()`d exactly like `getEditorPreferences`. It is one keyed query per
request, always current, and needs no change to `src/auth.ts`, to
`src/types/next-auth.d.ts`, or to the proxy. The webhook writes the column; the
next request reads it. No session refresh is involved, so "a page reload after
checkout picks up the new status" is true *by default* rather than as a
workaround.

If `isPro` is later genuinely needed inside a client `useSession()`, the note's
`jwt` callback is the right fallback — it is written up in §6.9 with the two
extra changes it requires (augmenting `next-auth/jwt`, and reading `token.isPro`
in the `session` callback). It is not needed to ship.

### 4.3 Resolve the webhook's user by `stripeCustomerId`, with metadata as backup

Set `metadata.userId` on the Stripe customer **and** on
`subscription_data.metadata` at checkout. Then resolve in the webhook as:
`stripeCustomerId` lookup first, `metadata.userId` second. The column is
`@unique`, so the first path can only ever match one row; the metadata is there
for the case where the row write failed after the customer was created.

### 4.4 The count-then-write race

`prisma.item.count()` followed by `prisma.item.create()` has a window: two
concurrent requests at 49 items can both pass and land on 51.

The codebase's precedent for "let the database decide" (`createCollection`
catching P2002 on `@@unique([userId, name])`) does not transfer — Postgres has
no constraint that expresses "at most 50 rows per user".

**Recommendation:** do the count and the create inside one
`prisma.$transaction(async (tx) => { ... })` in the db-layer function. This
narrows the window to the transaction's duration. It does not close it fully
without `SELECT ... FOR UPDATE` on the user row, which would serialise every
item create for the sake of a user briefly holding 51 items. State the residual
in the doc comment and accept it; do not pretend the check is exact.

### 4.5 Downgrade policy — **this needs a decision from you**

A Pro user with 200 items who cancels is instantly over the free ceiling. The
options:

| Policy | Behaviour | Assessment |
|---|---|---|
| **Read-only overage** (recommended) | Existing items all stay visible and editable; *new* creates are refused until under the limit | Standard, no data loss, no surprise |
| Hard lock | App becomes read-only entirely until they prune | Punitive; invites chargebacks |
| Delete overage | Destroys user data | Never |

The plan below assumes **read-only overage**, which falls out naturally: the
gate only guards `createItem` / `createCollection` / uploads. Nothing else
changes. The same applies to uploads a free user already owns (§2.5) — they keep
working; only new ones are refused.

### 4.6 Optional: store subscription status and period end

The minimum viable column set already exists. But `isPro: boolean` cannot
express "cancelled, still paid through the 28th" or "payment failed, in grace".
If the billing card should say *when* a subscription renews or lapses, add:

```prisma
stripeSubscriptionStatus String?   // 'active' | 'past_due' | 'canceled' | ...
stripeCurrentPeriodEnd   DateTime?
```

That is a second migration, purely additive, no backfill. **It is not required
to ship** — omit it in phase 1 and add it when the billing card needs to show
more than on/off.

### 4.7 Webhook idempotency and ordering

Stripe retries, and does **not** guarantee event order. Two mitigations, both
cheap:

- **Idempotency**: every handler here is a `user.update` setting absolute values
  (`isPro: true` / `false`). Applying it twice is a no-op. No dedupe table is
  needed — but say so in a comment, so nobody "fixes" it later by making a
  handler relative.
- **Ordering**: never infer state from *which* event arrived. On every
  subscription event, read `subscription.status` off the event object and derive
  `isPro` from it. A stale `customer.subscription.deleted` arriving after a new
  `created` is the one case this does not cover; guard it by only clearing
  `stripeSubscriptionId` when the id in the event matches the id on the row.

---

## 5. Files to create

### 5.1 `src/lib/stripe.ts`

```ts
import 'server-only';

import Stripe from 'stripe';

/**
 * The Stripe client, built lazily and reused.
 *
 * Lazy rather than at module scope for the reason `src/lib/rate-limit.ts` and
 * `src/lib/email/client.ts` are: the key is read at call time, so `next build`
 * cannot depend on the build machine having it. A module-level
 * `new Stripe(process.env.STRIPE_SECRET_KEY!)` breaks any build without the
 * secret present.
 *
 * `apiVersion` is deliberately omitted. It defaults to the version this SDK
 * release was generated against, which is the version its TypeScript types
 * describe — pinning a different literal makes the types lie.
 */
let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  client = new Stripe(key, { maxNetworkRetries: 2 });

  return client;
}

/** The two prices, read at call time for the same reason as the key. */
export function getPriceId(interval: 'monthly' | 'yearly'): string {
  const id = (
    interval === 'yearly'
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY
  )?.trim();

  if (!id) {
    throw new Error(`Stripe price id for ${interval} is not set`);
  }

  return id;
}
```

### 5.2 `src/lib/plan.ts` — the limits, as pure testable logic

```ts
/**
 * Free-tier ceilings. These are a public promise: `src/components/home/content.tsx`
 * already advertises "50 items" and "3 collections" on the marketing page, so
 * they cannot be changed here alone.
 *
 * Not in the database: which limits apply to which plan is a pricing decision,
 * not a property of a row — the same call `src/lib/pro.ts` and
 * `src/lib/features.ts` make.
 */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/** Pro-only item types, by slug. Re-exported through `isProType`'s own set. */
export type PlanLimitKind = 'items' | 'collections';

/**
 * Whether one more row may be created.
 *
 * Pure so it can be unit tested without a database. Pro is unlimited, which is
 * expressed as the check simply not applying rather than as `Infinity`.
 */
export function isWithinLimit(
  kind: PlanLimitKind,
  currentCount: number,
  isPro: boolean,
): boolean {
  if (isPro) return true;

  const limit = kind === 'items' ? FREE_ITEM_LIMIT : FREE_COLLECTION_LIMIT;

  return currentCount < limit;
}

/** The sentence a refused create shows. Names the limit, so it is actionable. */
export function limitMessage(kind: PlanLimitKind): string {
  return kind === 'items'
    ? `Free accounts are limited to ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`
    : `Free accounts are limited to ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;
}
```

Co-locate `src/lib/plan.test.ts` — boundary cases at 49/50/51, Pro bypassing
both, and the message naming the right number.

### 5.3 `src/lib/db/billing.ts`

```ts
import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Whether the signed-in user is on Pro.
 *
 * Its own keyed query rather than a column added to `getCurrentUser`, which the
 * app shell runs on every request — the reasoning `getEditorPreferences` sets
 * out: `ProfileUser extends CurrentUser`, so widening that query would push the
 * flag into two more types that do not render it.
 *
 * Read from the row rather than from the JWT, deliberately. The session token
 * outlives the row it names, and a subscription can lapse between one request
 * and the next — so the lookup, not the token, decides, exactly as it does for
 * the user's own existence.
 *
 * `cache`d, so however many gates ask during one request, it is one query.
 */
export const isProUser = cache(async (): Promise<boolean> => {
  const session = await auth();

  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  return user?.isPro ?? false;
});

/** What the billing card on /settings renders. Null when nobody is signed in. */
export const getBillingStatus = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
});

/**
 * Records the Stripe customer against the user. Separate from the webhook's
 * writes because it runs in the checkout request, before any event arrives.
 */
export async function linkStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });
}

/**
 * Applies a subscription's state to the user it belongs to.
 *
 * Keyed on `stripeCustomerId`, which is `@unique`, so this can match at most
 * one row. Absolute rather than relative — setting `isPro` to the same value
 * twice is a no-op, which is what makes the webhook safe to retry without a
 * dedupe table. Do not make this toggle or increment anything.
 *
 * Returns false when no row matched, so the caller can log a customer we do
 * not know about rather than failing silently.
 */
export async function applySubscriptionState(
  stripeCustomerId: string,
  subscriptionId: string | null,
  isActive: boolean,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { stripeCustomerId },
    data: {
      isPro: isActive,
      stripeSubscriptionId: subscriptionId,
    },
  });

  return result.count > 0;
}
```

`updateMany` rather than `update` so a missing row is a count of 0 rather than a
thrown P2025 — a webhook for an unknown customer should be logged and
acknowledged, never retried forever.

### 5.4 `src/actions/billing.ts`

```ts
'use server';

import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { absoluteUrl } from '@/lib/app-url';
import { getBillingStatus, linkStripeCustomer } from '@/lib/db/billing';
import { getPriceId, getStripe } from '@/lib/stripe';
import type { BillingInterval } from '@/types/billing';

const SIGNED_OUT = 'Your session has expired. Sign in again.';

/**
 * Starts a Checkout session and redirects to Stripe.
 *
 * The customer is created lazily, here, rather than at registration: a free
 * user who never upgrades should leave nothing behind in Stripe, and
 * registration should not depend on a third-party call that can fail.
 *
 * `absoluteUrl` supplies the return origins rather than the request's `Host`
 * header, which a caller controls — the same reason the verification emails
 * use it.
 */
export async function startCheckout(interval: BillingInterval) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return { success: false as const, error: SIGNED_OUT };
  }

  const userId = session.user.id;
  let url: string;

  try {
    const stripe = getStripe();
    const billing = await getBillingStatus();

    // Already subscribed — the portal is the right door, not a second checkout.
    if (billing?.isPro) {
      return { success: false as const, error: 'You are already on Pro.' };
    }

    let customerId = billing?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        // The backup path for resolving a webhook to a user, if the row write
        // below ever fails after the customer exists.
        metadata: { userId },
      });

      customerId = customer.id;
      await linkStripeCustomer(userId, customerId);
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getPriceId(interval), quantity: 1 }],
      // Carried onto the subscription itself, so every subscription event can
      // name its user without a second API call.
      subscription_data: { metadata: { userId } },
      success_url: absoluteUrl('/settings?checkout=success'),
      cancel_url: absoluteUrl('/settings?checkout=cancelled'),
      allow_promotion_codes: true,
    });

    if (!checkout.url) {
      return { success: false as const, error: 'Could not start checkout. Please try again.' };
    }

    url = checkout.url;
  } catch (error) {
    console.error('Could not start Stripe checkout:', error);

    return { success: false as const, error: 'Could not start checkout. Please try again.' };
  }

  // Outside the try: `redirect` throws NEXT_REDIRECT by design, and catching it
  // would turn a successful redirect into the generic error above.
  redirect(url);
}

/** Opens the Stripe billing portal, where a subscription is changed or cancelled. */
export async function openBillingPortal() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: SIGNED_OUT };
  }

  let url: string;

  try {
    const billing = await getBillingStatus();

    if (!billing?.stripeCustomerId) {
      return { success: false as const, error: 'No billing account to manage yet.' };
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: absoluteUrl('/settings'),
    });

    url = portal.url;
  } catch (error) {
    console.error('Could not open the Stripe billing portal:', error);

    return { success: false as const, error: 'Could not open billing. Please try again.' };
  }

  redirect(url);
}
```

**The `redirect()`-outside-`try` detail is not stylistic.** `redirect()` works by
throwing `NEXT_REDIRECT`; inside the `try` it would be swallowed by the `catch`
and reported as a generic failure while the user stayed put.

### 5.5 `src/app/api/stripe/webhook/route.ts`

```ts
import type Stripe from 'stripe';
import { NextResponse } from 'next/server';

import { applySubscriptionState } from '@/lib/db/billing';
import { getStripe } from '@/lib/stripe';

/**
 * Stripe's webhook endpoint.
 *
 * The one route in the app that is not authenticated by session — it is called
 * by Stripe, not by a user — so the signature is what authenticates it.
 * `src/proxy.ts` does not match `/api`, so nothing else stands in front of it.
 *
 * The raw body is required: `constructEvent` verifies an HMAC over the exact
 * bytes Stripe sent, so `request.json()` (which re-serialises) would fail every
 * time. `request.text()` is the App Router equivalent of express.raw().
 *
 * Every handler below sets absolute values, so applying an event twice is a
 * no-op and Stripe's retries need no dedupe table. Do not make any of them
 * relative.
 */

/** The statuses that grant Pro. Anything else — past_due, canceled, unpaid — does not. */
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing']);

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set; refusing the webhook.');

    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    // A bad signature is the expected shape of an attack, so it is logged but
    // never echoed back in detail.
    console.error('Stripe webhook signature verification failed:', error);

    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Fires once the customer finishes paying. Under the Basil API the
      // subscription is created after payment completes, so it is present here.
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.mode !== 'subscription') break;

        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null;

        if (!customerId) break;

        const matched = await applySubscriptionState(customerId, subscriptionId, true);

        if (!matched) {
          console.error(`Stripe checkout completed for an unknown customer: ${customerId}`);
        }

        break;
      }

      // Every later change: renewal, cancellation, payment failure, plan swap.
      // State is read off the subscription rather than inferred from which
      // event arrived, because Stripe does not guarantee ordering.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : null;

        if (!customerId) break;

        const isActive =
          event.type !== 'customer.subscription.deleted' &&
          ACTIVE_STATUSES.has(subscription.status);

        await applySubscriptionState(
          customerId,
          isActive ? subscription.id : null,
          isActive,
        );

        break;
      }

      default:
        // Acknowledged, not an error: Stripe will send event types we did not
        // subscribe to, and a non-2xx would have it retry them forever.
        break;
    }
  } catch (error) {
    // A 500 asks Stripe to retry, which is correct for a transient database
    // failure — the handlers are idempotent, so a retry is safe.
    console.error(`Failed to handle Stripe event ${event.type}:`, error);

    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

### 5.6 `src/types/billing.ts`

```ts
export type BillingInterval = 'monthly' | 'yearly';

/** What the billing card on /settings renders. */
export interface BillingStatus {
  isPro: boolean;
  /** False for a Pro user who has never had a Stripe customer (e.g. granted manually). */
  canManage: boolean;
}

export type StartCheckoutResult = { success: false; error: string };
```

`startCheckout` only ever *returns* on failure — success is a `redirect()` — so
the result type has no success arm. That is intentional and worth the comment.

### 5.7 `src/components/settings/BillingSettings.tsx`

A server component following `AccountSettings`'s shape (`Card` →
`CardHeader` → `CardContent className="divide-y"` → `SettingsRow`), with a
client child holding the buttons:

- **Free**: one row, "DevFetch Pro", description naming both prices, action = a
  client component with Monthly / Yearly buttons calling `startCheckout`.
- **Pro**: one row, "DevFetch Pro", description "Your subscription is active",
  action = a "Manage billing" button calling `openBillingPortal`.

Both buttons need `useTransition` and a pending label, following
`DeleteAccountDialog`'s precedent — and specifically must **not** be
`AlertDialogAction` or a `DropdownMenuItem`, which unmount on click and would
tear down the transition mid-request. That trap is recorded three times in this
project's history.

### 5.8 Test files to create

| File | Covers |
|---|---|
| `src/lib/plan.test.ts` | limit boundaries at 49/50/51 and 2/3/4, Pro bypass, message text |
| `src/lib/stripe.test.ts` | throws on missing key; reads at call time (a second stub flips the answer); price id per interval |
| `src/lib/db/billing.test.ts` | `isProUser` short-circuits with no session and never queries; `applySubscriptionState` keys on `stripeCustomerId`; returns false on 0 matched |
| `src/actions/billing.test.ts` | session guard; already-Pro refusal; customer reused when present, created when absent; `metadata.userId` set on both customer and subscription |
| `src/actions/items.test.ts` (extend) | free user at 50 refused; at 49 allowed; Pro at 500 allowed |
| `src/actions/collections.test.ts` (extend) | same at 3 |

Mutations worth running (this project's convention): drop the Pro bypass from
`isWithinLimit`; make the limit `<=` instead of `<`; key `applySubscriptionState`
on `id` instead of `stripeCustomerId`; have the webhook trust `event.type`
instead of `subscription.status`; remove the signature check.

---

## 6. Files to modify

### 6.1 `src/actions/items.ts` — the item gate

After the existing session check in `createItem` (line ~71), before the schema
parse is fine; before the write is what matters:

```ts
const isPro = await isProUser();

if (!isPro) {
  const count = await prisma.item.count({ where: { userId: session.user.id } });

  if (!isWithinLimit('items', count, isPro)) {
    return { success: false, error: limitMessage('items') };
  }
}
```

Better (per §4.4): move the count into `createItem` in `src/lib/db/items.ts`,
inside a `$transaction` with the create, returning `{ ok: false, reason:
'limit-reached' }` — matching the tagged-outcome pattern `createCollection`
already uses. The action then maps that reason to `limitMessage('items')`.

Note `createItem` currently returns `ItemDetail | null`, where `null` means
"no session". Adding a second failure reason means widening it to a tagged
outcome, which is the shape `createCollection` already has — so this is a
convergence, not a divergence.

Also gate the upload branch: inside the existing `if (required.file)` block,
refuse when `!isPro` (see §2.5 — creation only, never reading).

### 6.2 `src/actions/collections.ts` — the collection gate

Same shape, `limitMessage('collections')`, with the count inside
`createCollection` in `src/lib/db/collections.ts`. That function already returns
`CreateCollectionOutcome`, so this is one new `reason` in an existing union:

```ts
export type CreateCollectionOutcome =
  | { ok: true; collection: DashboardCollection }
  | { ok: false; reason: 'no-session' | 'duplicate-name' | 'limit-reached' };
```

### 6.3 `src/app/api/uploads/route.ts` — the upload gate

Immediately after the existing `getCurrentUserId()` check, before the
`content-length` read:

```ts
if (!(await isProUser())) {
  return fail('File and image uploads are a Pro feature. Upgrade to enable them.', 403);
}
```

403 rather than 402: the request is understood and the user is authenticated,
they are simply not permitted. (402 Payment Required is technically apt but is
still reserved and inconsistently handled by clients.)

### 6.4 `src/app/settings/page.tsx`

Add `getBillingStatus()` to the existing `Promise.all`, and render
`<BillingSettings />` **above** `<EditorPreferencesSettings />`:

```ts
const [user, itemStats, collectionStats, editorPreferences, billing] =
  await Promise.all([
    getProfileUser(),
    getItemStats(),
    getCollectionStats(),
    getEditorPreferences(),
    getBillingStatus(),
  ]);
```

The page already mounts its own `<Toaster />`, so the `?checkout=success` banner
has somewhere to render.

### 6.5 `src/components/home/PlanCard.tsx`

The Pro CTA currently points at `REGISTER_PATH` for both plans. It should:

- **Signed out** → `/register` (unchanged; they must have an account to bill).
- **Signed in, free** → start checkout.
- **Signed in, Pro** → `/settings`.

The homepage is already dynamic (`/` calls `getCurrentUser()` and is
`force-dynamic` per the Homepage feature), so the signed-in branch is available
without adding a query. Thread an `isPro`/`isSignedIn` prop down through
`PricingSection` → `BillingToggle` → `PlanCard`.

`BillingToggle` already holds the monthly/yearly state — that is exactly the
`interval` a checkout needs, so the plumbing is already there.

### 6.6 `src/components/items/NewItemDialog.tsx` and `src/components/dashboard/SidebarContent.tsx`

Remove the two comments that say gating is deferred, and have the dialog show
File and Image as Pro-gated for free accounts (disabled with an upgrade hint
rather than hidden — a hidden feature cannot be sold). `isProType` already
identifies them; it just needs the user's plan alongside it.

### 6.7 `.env.example`

Replace the staged Stripe block with one that is documented like the others in
that file, and **drop `STRIPE_PUBLISHABLE_KEY`** (§1.3):

```
# Stripe. Test-mode keys from dashboard.stripe.com/test/apikeys.
STRIPE_SECRET_KEY=""

# Signing secret for POST /api/stripe/webhook. In development this is printed
# by `stripe listen --forward-to localhost:3000/api/stripe/webhook` and differs
# from the one the Dashboard shows for a deployed endpoint — they are not
# interchangeable. Unset, the webhook refuses every request with a 500 rather
# than trusting an unverified body.
STRIPE_WEBHOOK_SECRET=""

# The two recurring prices on the DevFetch Pro product.
STRIPE_PRICE_ID_MONTHLY=""
STRIPE_PRICE_ID_YEARLY=""
```

### 6.8 `package.json`

```
npm install stripe
```

Nothing else. The hosted-Checkout redirect needs no `@stripe/stripe-js` and no
`@stripe/react-stripe-js`.

### 6.9 Optional — `src/auth.ts` and `src/types/next-auth.d.ts`

**Only if `isPro` is genuinely needed in a client `useSession()`.** See §4.2 for
why this is not recommended as the primary mechanism. If adopted, it is three
changes, not one:

```ts
// src/auth.ts
callbacks: {
  async jwt({ token }) {
    if (token.sub) {
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { isPro: true },
      });

      token.isPro = dbUser?.isPro ?? false;
    }

    return token;
  },
  session({ session, token }) {
    if (token.sub) session.user.id = token.sub;
    session.user.isPro = token.isPro ?? false;   // <- also required
    return session;
  },
},
```

```ts
// src/types/next-auth.d.ts — both augmentations are required
declare module 'next-auth' {
  interface Session {
    user: { id: string; isPro: boolean } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isPro?: boolean;
  }
}
```

Note the prompt's snippet also sets `token.sub = user.id` on sign-in; that is
redundant here — `@auth/core` already does it in its own callback handler, which
is exactly why `src/auth.ts` has no `jwt` callback today.

**Cost to measure if you do this:** count Prisma queries per authenticated page
load before and after. Expect up to three extra `findUnique`s, not one (§4.2).

---

## 7. Stripe Dashboard setup

All in **test mode** first (`dashboard.stripe.com/test/...`).

1. **Product** — Products → Add product. Name `DevFetch Pro`. Description
   "Unlimited items and collections, file and image uploads, custom types, AI
   features and export."
2. **Prices** — add two recurring prices on that one product:
   - `$8.00 USD` / monthly → copy the `price_...` id → `STRIPE_PRICE_ID_MONTHLY`
   - `$72.00 USD` / yearly → copy the `price_...` id → `STRIPE_PRICE_ID_YEARLY`

   Two prices on **one** product, not two products — that is what lets the
   billing portal offer a switch between them.
3. **API key** — Developers → API keys → copy the secret key (`sk_test_...`) →
   `STRIPE_SECRET_KEY`. Never the publishable key (§1.3).
4. **Billing portal** — Settings → Billing → Customer portal. Turn on: cancel
   subscription, update payment method, switch plan (add both prices to the
   allowed list), and invoice history. Set the default return URL to
   `http://localhost:3000/settings`, overridden per session by `return_url`.
5. **Webhook, development** — do **not** create a Dashboard endpoint for local
   work. Run:
   ```
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   It prints `whsec_...` → `STRIPE_WEBHOOK_SECRET` in `.env`. This secret is
   specific to the CLI session and is **not** the same as a Dashboard
   endpoint's.
6. **Webhook, production** — Developers → Webhooks → Add endpoint →
   `https://<your-domain>/api/stripe/webhook`. Select exactly four events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy that endpoint's signing secret into the production environment. Do not
   select "all events" — every unhandled type is a request the server answers
   for nothing.
7. **Before going live** — repeat 1–4 and 6 in live mode; the ids all differ.
   `APP_URL` must already point at the deployed origin, or `success_url` and
   `return_url` will send paying customers to localhost.

---

## 8. Testing checklist

### 8.1 Unit (`npm run test`)

- [ ] `isWithinLimit` — 49 → true, 50 → false, 51 → false for items; 2/3/4 for collections
- [ ] `isWithinLimit` — Pro true at any count, including 0 and 10,000
- [ ] `limitMessage` names the right number for each kind
- [ ] `getStripe` throws with `STRIPE_SECRET_KEY` unset; a second env stub flips the answer (proves call-time reads)
- [ ] `getPriceId` returns the right var per interval and throws when unset
- [ ] `isProUser` returns false with no session **and issues no query**
- [ ] `applySubscriptionState` filters on `stripeCustomerId`, returns false at 0 matched
- [ ] `startCheckout` refuses with no session; refuses when already Pro
- [ ] `startCheckout` reuses an existing `stripeCustomerId` and creates one only when absent
- [ ] `startCheckout` sets `metadata.userId` on the customer **and** `subscription_data.metadata`
- [ ] `createItem` refused at 50 for free, allowed at 49, allowed at 500 for Pro
- [ ] `createCollection` refused at 3 for free, allowed at 2
- [ ] Suite runs green under `env -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET` (nothing reaches Stripe)

### 8.2 Mutations (prove the tests discriminate)

Restore sources from **file backups, never `git checkout`** — this project has
lost uncommitted work to that once.

- [ ] Drop the Pro bypass from `isWithinLimit` → red
- [ ] `<` → `<=` in the limit check → red
- [ ] `applySubscriptionState` keyed on `id` instead of `stripeCustomerId` → red
- [ ] Webhook infers `isPro` from `event.type` rather than `subscription.status` → red
- [ ] Signature verification removed from the webhook → red
- [ ] `startCheckout`'s session guard removed → red

### 8.3 Webhook, against the Stripe CLI

With `stripe listen` running and the dev server up:

- [ ] `stripe trigger checkout.session.completed` → 200, and the handler is reached
- [ ] A **real** test checkout with card `4242 4242 4242 4242` → redirect to Stripe, pay, land on `/settings?checkout=success`
- [ ] `User.isPro` is `true` and `stripeCustomerId` / `stripeSubscriptionId` are both populated, read directly from the **development** Neon branch
- [ ] Replaying the same event a second time changes nothing (idempotency)
- [ ] A tampered body → **400**, `isPro` unchanged
- [ ] A missing `stripe-signature` header → **400**
- [ ] `STRIPE_WEBHOOK_SECRET` unset → **500** and a log line, never a silent accept
- [ ] An event for a customer id no row holds → 200 with an error logged, not a retry loop
- [ ] Cancel via the billing portal → `customer.subscription.deleted` → `isPro` false, `stripeSubscriptionId` null
- [ ] Payment failure (`stripe trigger invoice.payment_failed` then a `past_due` subscription update) → `isPro` false

### 8.4 Gating, in a real browser

- [ ] Free account at 49 items creates the 50th; the 51st is refused with the message naming the limit
- [ ] Free account at 3 collections is refused; the top bar dialog keeps the typed values (the uncontrolled-form defect this project hit in Auth Phase 3)
- [ ] Free account cannot upload: `POST /api/uploads` returns **403**, and the New Item dialog shows File/Image as Pro
- [ ] A free account that **already owns** an uploaded file can still view and download it (§2.5 — no data loss on gate day)
- [ ] Pro account creates past 50 items and past 3 collections, and uploads
- [ ] After a successful checkout, a **plain page reload** shows Pro — no sign-out required (this is what §4.2's server-side read buys)
- [ ] Downgrade: a Pro account with 60 items cancels → all 60 still visible and editable, the 61st refused
- [ ] Billing card: free shows Monthly/Yearly buttons; Pro shows "Manage billing" opening the portal
- [ ] Pending states caught mid-flight on both buttons, with the button disabled
- [ ] Zero page overflow at 390 and 1440 on `/settings` with the new card
- [ ] Zero console errors or warnings

### 8.5 Gates

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit` — this project has repeatedly caught typed-Prisma-mock failures that lint and a green suite both missed
- [ ] `npm run build`
- [ ] `npm run db:test`

---

## 9. Implementation order

Each step leaves the app working, and each is independently verifiable.

**Phase 1 — plumbing, no user-visible change**
1. `npm install stripe`; rewrite the `.env.example` Stripe block (§6.7).
2. `src/lib/stripe.ts` + `src/lib/stripe.test.ts`.
3. `src/lib/plan.ts` + `src/lib/plan.test.ts`.
4. `src/lib/db/billing.ts` + `src/lib/db/billing.test.ts`.
   Verify: suite green; `npm run build` passes **with the Stripe vars unset**
   (proves the lazy client).

**Phase 2 — webhook first, before anything can sell**
5. Stripe Dashboard steps 1–3 and 5 (product, prices, key, `stripe listen`).
6. `src/app/api/stripe/webhook/route.ts`.
   Verify: §8.3's signature, tampering, unset-secret and unknown-customer cases
   — all reachable with `stripe trigger` before any checkout exists.

   *Webhook before checkout is deliberate.* If checkout ships first, the first
   real payment has nothing listening and a paying customer is not upgraded.

**Phase 3 — selling**
7. `src/types/billing.ts`, `src/actions/billing.ts`.
8. `src/components/settings/BillingSettings.tsx`; wire into
   `src/app/settings/page.tsx`.
9. Dashboard step 4 (billing portal config).
   Verify: a real test checkout end to end, then the portal, then cancel.

**Phase 4 — enforcing** *(the only phase that changes behaviour for existing users)*
10. Item limit: db-layer count in a transaction + action mapping + tests.
11. Collection limit: same.
12. Upload gate in `/api/uploads` and in `createItem`'s file branch.
13. `NewItemDialog` / `SidebarContent` Pro marking (§6.6).
    Verify: §8.4 in full, especially the existing-uploads case.

**Phase 5 — the funnel**
14. `PlanCard` CTA routing by plan and sign-in state (§6.5).
15. Live-mode Dashboard setup and the production webhook endpoint.

**Deferred, deliberately** — do not build these now:
- AI, export and custom-type gates (§2.4): the features do not exist.
- `stripeSubscriptionStatus` / `stripeCurrentPeriodEnd` (§4.6): add when the
  billing card needs to show more than on/off.
- The `jwt` callback (§4.2/§6.9): add only if a client component genuinely needs
  `isPro` from `useSession()`.

---

## 10. Open questions for you

1. **Downgrade policy** (§4.5) — the plan assumes read-only overage. Confirm.
2. **Trial period** — no trial is planned above. If Pro should have one, it is
   `subscription_data.trial_period_days` on the Checkout session, and
   `trialing` is already in `ACTIVE_STATUSES`.
3. **`past_due` grace** — the plan drops Pro the moment a payment fails. A grace
   window is kinder but needs §4.6's status column to express.
4. **Currency** — `$` throughout the marketing copy; the plan assumes USD.
5. **Tax** — `automatic_tax: { enabled: true }` on the Checkout session if
   Stripe Tax is configured. Not included above.
6. **Manual Pro grants** — `BillingStatus.canManage` exists so a user with
   `isPro: true` and no `stripeCustomerId` (granted by hand) does not get a
   "Manage billing" button that would fail.

---

## Appendix: source references

| Fact | Where |
|---|---|
| Billing columns exist | `prisma/schema.prisma:37-39` |
| Session callback, no `jwt` callback | `src/auth.ts:112-121` |
| Proxy builds its own instance from `authConfig` | `src/proxy.ts:8` |
| "The lookup, not the token, decides" | `src/lib/db/user.ts:25-26` |
| Separate-query precedent | `src/lib/db/user.ts` (`getEditorPreferences` doc comment) |
| Env read at call time | `src/lib/features.ts`, `src/lib/rate-limit.ts` (`readConfig`, line 59) |
| Lazy client precedent | `src/lib/rate-limit.ts:47-77` |
| `absoluteUrl` and why not `Host` | `src/lib/app-url.ts` |
| Tagged-outcome pattern | `src/types/collection.ts:91` |
| Free/Pro feature copy | `src/components/home/content.tsx:135-172` |
| Item / collection counts | `src/lib/db/items.ts:676`, `src/lib/db/collections.ts:356` |
| Item create gate point | `src/actions/items.ts:71` |
| Upload route auth check | `src/app/api/uploads/route.ts:29-34` |
| "Gating lands with billing" | `src/lib/pro.ts:3`, `src/components/items/NewItemDialog.tsx:88` |
| Settings card pattern | `src/components/settings/AccountSettings.tsx` |
| Stripe docs consulted | Context7 `/stripe/stripe-node`, `/stripe/stripe-cli` |
