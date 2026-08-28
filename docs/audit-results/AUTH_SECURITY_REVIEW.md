# Auth Security Review

**Last audited:** 2026-08-28
**Scope:** NextAuth v5 credentials + GitHub, email verification, password reset, profile/account management
**Files reviewed:** 45

## Summary

The auth core is in good shape: hashing, token handling, scope separation and server-action
authorization are all correct and match the reasoning written into the comments. The two things
that survived scrutiny are a structural gap the project already knows about (no throttling
anywhere on auth) and one concrete bug in a helper that was written specifically to prevent it —
`safeCallbackUrl` rejects `//evil.example` but lets `/\evil.example` through, and browsers read
those two identically.

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 1     |
| Medium   | 1     |
| Low      | 2     |

The single highest-value fix to make first: add rate limiting to `POST /api/auth/register` and the
credentials sign-in action — those two, unthrottled, hand an anonymous attacker both an
enumeration oracle and unlimited password guesses against an 8-character-minimum policy.

## Findings

### High

#### H1. No rate limiting on any endpoint that accepts unauthenticated input

- **File:** `src/app/api/auth/register/route.ts:23`, `src/actions/auth.ts:53`, `src/actions/auth.ts:113`, `src/actions/auth.ts:183`, `src/actions/auth.ts:237`, `src/actions/profile.ts:45`, `src/app/verify-email/route.ts:14`
- **Flow:** Sign-in | Registration | Email verification | Password reset | Profile
- **Issue:** Nothing in `src/` counts, delays or blocks repeated requests — a grep for
  `rate|throttle|limiter` across `src/` returns only prose in comments. Seven endpoints accept
  input from a caller holding nothing, and each will serve an unbounded number of attempts.

- **Attack:** All of the following need only a network connection.

  1. **Password guessing** — `signInWithCredentials` (`src/actions/auth.ts:53`) calls
     `signIn('credentials', ...)` on every submit. `authorize` (`src/auth.ts:37`) runs one
     bcrypt-cost-12 compare and returns. `PASSWORD_MIN_LENGTH = 8` with no complexity rule
     (`src/lib/validation/auth.ts:7`), and the seeded demo account's password is `12345678`, so a
     credential-stuffing or top-10k-passwords run against a known address is unopposed. bcrypt
     cost 12 (~250ms) is the only brake, and it parallelizes.
  2. **Account enumeration at scale** — `POST /api/auth/register` returns `409` with
     `"An account with that email already exists"` (`src/app/api/auth/register/route.ts:49`) and
     `201` otherwise. That is a clean binary oracle, and unthrottled it enumerates the entire
     user base from a wordlist. This is what makes the careful non-disclosure work in
     `authorize`, `requestPasswordReset` and `resendVerificationEmail` moot in practice.
  3. **Bulk account creation** — the same endpoint creates a real `User` row per call, with
     `EMAIL_VERIFICATION` off (`src/lib/features.ts:24`) stamping `emailVerified` immediately.
     No CAPTCHA, no proof of work, no cap.
  4. **Email bombing a third party** — `requestPasswordReset` (`src/actions/auth.ts:183`) and
     `resendVerificationEmail` (`src/actions/auth.ts:113`) each send one Resend email per call
     to any address the caller names. Both are exported server actions, so they are callable
     without ever rendering the form. Secondary effect: this also burns the Resend sending quota
     and can get the sending domain reputation-flagged.
  5. **Reset-link denial of service** — every `requestPasswordReset` call for a registered
     address runs `issueScopedToken`, which deletes that address's outstanding reset token
     before writing a new one (`src/lib/auth/tokens.ts:57-69`). Repeatedly hitting the endpoint
     for a victim's address invalidates the link they are trying to use, faster than they can
     click it.
  6. **Current-password guessing from a stolen session** — `changePassword`
     (`src/actions/profile.ts:45`) compares `currentPassword` with no attempt counter. An
     attacker holding a session cookie can grind the current password to escalate a stolen
     session into permanent account ownership. Precondition: they already hold the session.

- **Fix:** One shared limiter in front of all of them, keyed differently per endpoint. Sign-in and
  change-password key on `email`/`user.id` **and** client IP; register, forgot-password and resend
  key on IP and on the target address (so one address cannot be mailed repeatedly from many IPs).
  A fixed-window counter in Redis/Upstash is enough; there is no in-process option that survives
  Vercel's serverless model. Sketch, applied at the top of each action and route:

  ```ts
  // src/lib/rate-limit.ts
  export async function assertWithinLimit(bucket: string, key: string, max: number, windowMs: number): Promise<boolean>
  ```

  For the enumeration half specifically, the limiter is the mitigation — `register` cannot stop
  returning 409 without breaking the form, so throttling per IP is what makes wordlist
  enumeration impractical.

### Medium

#### M1. `safeCallbackUrl` misses the backslash form of a protocol-relative URL (open redirect)

- **File:** `src/lib/auth-redirect.ts:20`, sink at `src/app/(auth)/sign-in/page.tsx:40`
- **Flow:** Sign-in
- **Issue:** The guard is

  ```ts
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_SIGNED_IN_PATH;
  ```

  `/\evil.example` starts with `/` and does not start with `//`, so it is returned unchanged. In
  the WHATWG URL parser — which every browser implements — a backslash is normalized to a forward
  slash for special schemes, so `/\evil.example` is parsed exactly like `//evil.example`: a
  protocol-relative URL resolving to `http://evil.example/`. The code contradicts its own comment,
  which states the intent is to reject anything "browsers read as protocol-relative".

- **Attack:** An attacker with nothing sends a signed-in DevFetch user
  `https://<devfetch-origin>/sign-in?callbackUrl=/\evil.example`. `SignInPage` resolves
  `getCurrentUser()`, finds a live row, and calls `redirect(callbackUrl)`. Next.js writes the
  string to the `location` header verbatim — `setHeader('location', redirectUrl)` with only
  `addPathPrefix` applied, `node_modules/next/dist/server/app-render/app-render.js:2390-2397` — so
  the response is `307` with `Location: /\evil.example`, and the browser lands on the attacker's
  origin. The link is on the real domain, passes casual inspection, and is a natural target for a
  cloned sign-in page. Precondition: the victim is signed in (a session whose user row still
  exists). Nothing else.

  The two `signIn(...)` call sites (`src/actions/auth.ts:80` and `:153`) are **not** affected:
  `@auth/core`'s default redirect callback prefixes the base URL for any value starting with `/`
  (`node_modules/@auth/core/lib/init.js:13-18`), producing `http://<origin>/\evil.example`, which
  parses same-origin. `src/app/(auth)/sign-in/page.tsx:40` is the only raw `redirect()` in the
  codebase that takes caller-supplied input.

- **Fix:** Stop pattern-matching the string and let the URL parser decide, which closes the
  backslash case and anything else the parser folds:

  ```ts
  export function safeCallbackUrl(value: unknown): string {
    if (typeof value !== 'string') return DEFAULT_SIGNED_IN_PATH;

    // Resolved against a throwaway origin: anything that escapes it — absolute,
    // protocol-relative, or the backslash spelling of either — changes the origin.
    let parsed: URL;
    try {
      parsed = new URL(value, 'http://localhost');
    } catch {
      return DEFAULT_SIGNED_IN_PATH;
    }

    if (parsed.origin !== 'http://localhost') return DEFAULT_SIGNED_IN_PATH;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  ```

  A one-line stopgap (`if (/[\\]/.test(value)) return DEFAULT_SIGNED_IN_PATH;`) also works, but the
  parser version is the one that does not need revisiting.

### Low

#### L1. Changing a password does not invalidate an outstanding reset link for the same address

- **File:** `src/actions/profile.ts:81-84`
- **Flow:** Profile | Password reset
- **Issue:** `changePassword` writes the new hash but leaves any live
  `password-reset:<email>` row in `VerificationToken` alone. `consumePasswordResetToken` spends
  its own token (`src/lib/auth/password-reset-token.ts:98-112`) and `deleteAccount` sweeps both
  scopes (`src/actions/profile.ts:153`), so this is the one credential-changing path that does
  not touch the token table.
- **Attack:** An attacker who at some point saw the victim's inbox — a briefly unlocked laptop, a
  forwarded email, a shared family account — triggers `/forgot-password` and keeps the link
  without using it. The victim notices something is wrong and changes their password from
  `/profile`. For the remainder of the token's 1-hour TTL the attacker's link still works and
  overwrites the password the victim just chose. Precondition: the attacker already holds a live
  reset link, so this is defence-in-depth rather than a fresh entry point — but the victim's one
  available remedy currently does not remedy it.
- **Fix:** Fold the sweep into the same transaction as the update, using the helper the app
  already writes with:

  ```ts
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(...) } }),
    prisma.verificationToken.deleteMany({
      where: { identifier: scopedIdentifier(TOKEN_SCOPES.passwordReset, user.email) },
    }),
  ]);
  ```

#### L2. Forgot-password and resend-verification leak registration status through response time

- **File:** `src/actions/auth.ts:212-213`, `src/actions/auth.ts:141-142`
- **Flow:** Password reset | Email verification
- **Issue:** Both actions return an identical body for every outcome, which is correct, but both
  `await` the send on the "address exists" branch only. A registered address therefore costs one
  `findUnique`, two `VerificationToken` writes (`src/lib/auth/tokens.ts:57-69`) and a full HTTPS
  round-trip to Resend; an unknown address costs one `findUnique`. That is a difference of
  hundreds of milliseconds, not microseconds — no statistical technique is needed to read it.
  This is noted as open in `context/current-feature.md`; what is added here is that it is a
  reliably observable gap, not a marginal one, and the specific fix.
- **Attack:** An attacker with nothing times `POST` responses to `/forgot-password` and sorts a
  wordlist into "registered with a password" and "not". In practice this adds little, because
  `POST /api/auth/register` already answers the same question directly and unambiguously (see
  H1) — which is why this is Low and not Medium. It becomes the primary oracle only once H1 is
  fixed, so fix both together.
- **Fix:** Move the send off the response path so both branches return after the same work.
  `import { after } from 'next/server'` and wrap the send:

  ```ts
  if (user?.password) {
    after(() => sendPasswordResetEmail(parsed.data.email));
  }
  ```

  The reply is already unconditional, so nothing else in either action changes.

## Passed Checks

### Password handling

- One shared `hashPassword` at bcrypt cost 12 (`src/lib/auth/password.ts:8-12`), used by
  registration (`src/app/api/auth/register/route.ts:58`), reset
  (`src/lib/auth/password-reset-token.ts:94`) and change (`src/actions/profile.ts:83`). No path
  writes a plaintext or a differently-costed hash; no `bcrypt.hash` call exists outside that
  helper.
- The 72-byte bcrypt truncation is enforced in **bytes** via `TextEncoder`
  (`src/lib/validation/auth.ts:32-34`), so 19 emoji are correctly rejected as 76 bytes.
- Comparison is always `bcrypt.compare`, never `===` on a hash — `src/auth.ts:52` and
  `src/actions/profile.ts:73`. No string comparison of hashes exists anywhere in `src/`.
- An unknown email still pays exactly one bcrypt against `DUMMY_PASSWORD_HASH`
  (`src/auth.ts:52`), and that constant is a real `$2b$12$` hash, matching the live cost. The
  `!user?.password` guard (`src/auth.ts:54`) fires before the comparison result can matter, so a
  `password: null` GitHub row cannot be signed into by supplying the dummy's plaintext.
- `User.password` never reaches a client. It is selected in exactly three places
  (`src/auth.ts:48`, `src/actions/profile.ts:28`, `src/lib/db/user.ts:65`); the first two stay in
  server-only modules and the third destructures it away before returning, exposing only
  `hasPassword` (`src/lib/db/user.ts:73-81`). `ProfileUser` (`src/types/user.ts:13-22`) has no
  password field, so the type system enforces it too.

### Session & authorization

- `src/lib/db/user.ts` and `src/lib/auth/*.ts` carry `import 'server-only'`, so a client component
  importing them fails the build.
- Every mutating server action re-derives the user from `auth()` plus a database lookup —
  `getSessionAccount()` (`src/actions/profile.ts:21-30`) — and none of them trusts an id, email or
  role from the form body.
- Every `prisma.user.update` is keyed on the session's own id: `src/actions/profile.ts:82`,
  `src/lib/auth/verification-token.ts:61` and `src/lib/auth/password-reset-token.ts:100` (the
  latter two on the id resolved from the token record, never from the request).
- The session callback puts only `token.sub` on `session.user.id` (`src/auth.ts:86-94`). Nothing
  sensitive rides in the JWT, and every consumer re-reads the row, so a token outliving its user
  resolves to `null` rather than authorizing anything.
- `redirect()` sinks are all constants except the one in M1: `src/actions/auth.ts:156` and `:274`,
  `src/actions/profile.ts:166`, `src/app/profile/page.tsx:36`, `src/app/(auth)/register/page.tsx:17`.
- `AUTH_SECRET`, `RESEND_API_KEY`, `AUTH_GITHUB_SECRET` and `DATABASE_URL` are read only from
  `process.env` in server modules (`src/lib/email/client.ts:12,23`, `src/lib/prisma.ts:14`,
  `src/lib/app-url.ts:7`). No secret is hardcoded, none is named `NEXT_PUBLIC_`, and `.env.example`
  ships every value blank with `EMAIL_VERIFICATION="off"` deliberately commented out
  (`.env.example:30`) so copying it yields verification on.
- Emailed links use `APP_URL` rather than the request's `Host` header (`src/lib/app-url.ts:7`), so
  a header-injection attempt cannot point a verification link at another origin.

### Email verification

- Tokens are `randomBytes(32)` base64url — 256 bits from a CSPRNG (`src/lib/auth/tokens.ts:33,49`).
  No `Math.random` exists in `src/`.
- Only a SHA-256 digest is stored (`src/lib/auth/tokens.ts:28-30,65`); the plaintext exists only
  in the email.
- The 24h TTL is written **and enforced on read**, with the expired row deleted on the way through
  rather than left retryable (`src/lib/auth/tokens.ts:109-113`,
  `src/lib/auth/verification-token.ts:16`).
- Single use, and burned on every branch that should burn it: the success path deletes in the same
  `$transaction` as the `emailVerified` stamp (`src/lib/auth/verification-token.ts:60-63`), and the
  `unknown-user` branch deletes too (`:53`).
- Reissue invalidates the previous link — `issueScopedToken` deletes this scope's outstanding row
  before creating the new one (`src/lib/auth/tokens.ts:57-61`), so several live links cannot
  accumulate. The emails say so and carry a UTC timestamp (`src/lib/email/sent-at.ts:24-26`).
- Scope confusion is closed. `findScopedToken` demands the `<scope>:` prefix and reports a
  cross-scope hit as `invalid` **without deleting it** (`src/lib/auth/tokens.ts:105-106`), so a
  probe cannot be used to destroy the other scope's live token. The reissue sweep is likewise
  scoped to one identifier, so requesting a reset does not kill a pending verification link.
- Unbounded growth is handled: `issueScopedToken` sweeps every expired row globally on each issue,
  via the `@@index([expires])` the schema carries (`src/lib/auth/tokens.ts:59`,
  `prisma/schema.prisma:79`). `scripts/prune-users.ts:114-116` and `src/actions/profile.ts:153`
  both expand addresses through `allScopedIdentifiers`, so nothing is orphaned by a delete.
- The gate sits **after** the bcrypt comparison (`src/auth.ts:64`, following `:52-56`), so an
  unverified account with a wrong password is byte-identical to an unknown email.
- With `EMAIL_VERIFICATION` off, registration stamps `emailVerified` at creation
  (`src/app/api/auth/register/route.ts:65`), so turning the flag back on does not strand accounts
  created meanwhile. The flag defaults to **on** for any unset or misspelled value
  (`src/lib/features.ts:25`) and is read at call time, not module scope.

### Password reset

- 1h TTL against verification's 24h (`src/lib/auth/password-reset-token.ts:18`) — correctly
  shorter, since this one changes a credential.
- `checkPasswordResetToken` validates without spending (`src/lib/auth/password-reset-token.ts:38-42`),
  so the `GET` at `/reset-password` survives a mail scanner prefetch; only the `POST` spends it.
- The password write and the token delete are one `$transaction`
  (`src/lib/auth/password-reset-token.ts:98-112`), so neither can land alone.
- `password: null` accounts cannot be converted: no link is ever issued for them
  (`src/actions/auth.ts:212`) and `consumePasswordResetToken` refuses one as a floor even if it
  arrived (`src/lib/auth/password-reset-token.ts:88-92`).
- The email being reset comes from the token record (`lookup.email`,
  `src/lib/auth/password-reset-token.ts:70`), never from the form body — `resetPasswordSchema`
  has no email field at all (`src/lib/validation/auth.ts:81-86`).
- Response body is identical for a known address, an unknown address and a GitHub-only account
  (`src/actions/auth.ts:219`, rendered at `src/components/auth/ForgotPasswordForm.tsx:25-27`).
  The remaining difference is timing only — see L2.
- **Post-reset session state:** existing sessions survive a password change. Sessions are JWTs
  (`src/auth.ts:84`) with no server-side record and no revocation mechanism, so a session issued
  before the reset stays valid until it expires on its own. Concrete impact: an attacker who has
  already stolen a session cookie keeps their access after the victim resets or changes the
  password — resetting the credential does not evict them. `ChangePasswordForm` states this
  plainly to the user (`src/components/profile/ChangePasswordForm.tsx:42-43`). Requiring the
  current password to change it (`src/actions/profile.ts:73`) is the compensating control and it
  is present.

### Profile & account deletion

- `/profile` resolves through `auth()` **and** a database lookup (`getProfileUser`,
  `src/lib/db/user.ts:50-67`) and redirects when the row is gone (`src/app/profile/page.tsx:35-37`).
- The redirect-loop pair is closed: `/sign-in` also resolves through `getCurrentUser()` rather
  than `auth()` alone (`src/app/(auth)/sign-in/page.tsx:29,39`), so a JWT naming a deleted row no
  longer bounces between the two. `/register` uses `auth()` alone
  (`src/app/(auth)/register/page.tsx:14`) but redirects to `/dashboard`, which tolerates a null
  user and does not redirect back — traced, no loop.
- Change password requires the current password (`src/actions/profile.ts:73`), and the OAuth-only
  guard lives in the **action** (`src/actions/profile.ts:69-71`), not only in the component that
  decides whether to render the form (`src/app/profile/page.tsx:55`).
- Delete compares the typed address against the session's own user and never uses it to select one
  (`src/actions/profile.ts:127`). The cascade is explicit and ordered, includes scoped tokens which
  have no FK (`src/actions/profile.ts:141-156`), runs in one transaction, and signs out afterwards
  (`:166`).
- No over-selection: `getProfileUser` pulls six columns and the page renders five of them, with the
  sixth reduced to a boolean before it leaves the function (`src/lib/db/user.ts:59-81`).
  `getCurrentUser` stays at four columns for the per-request sidebar path.
- Client components hold only what they render — `SidebarUser` receives `CurrentUser`
  (`src/components/dashboard/SidebarUser.tsx:22`) and `DeleteAccountDialog` receives the email and
  two counts (`src/components/profile/DeleteAccountDialog.tsx:23-28`). Nothing sensitive reaches
  the bundle.

## Known and Accepted

Gaps documented as deliberate or open in `context/current-feature.md`, confirmed still open:

- No rate limiting anywhere on auth. Now reported as H1, since rate limiting is explicitly in
  scope for this audit.
- Changing or resetting a password does not invalidate JWT sessions already issued; no revocation
  mechanism exists to hook into.
- Forgot-password and resend-verification do measurably more work for a registered address than an
  unknown one. Now reported as L2 with the concrete fix.
- Email change is unbuilt.
- The real GitHub OAuth round-trip has never been completed end to end from Phases 1–3 (it needs
  the account's own credentials); `OAuthAccountNotLinked` for credentials-then-GitHub on one
  address is therefore still unverified in practice.
- `findScopedToken` runs a `findFirst` on `token` with no index — a deliberate performance
  trade-off, not a security issue.
- A GitHub-only user sees only `Delete account` on `/profile`, with no copy explaining why there is
  no password option.
