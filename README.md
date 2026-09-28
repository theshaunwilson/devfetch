# DevFetch

A developer knowledge hub for snippets, commands, prompts, notes, files, images
and links — one searchable place instead of a dozen scattered ones.

It is a full-stack SaaS app: collections, ⌘K search, a Monaco code editor,
private file uploads, a Stripe-billed Pro plan and four AI features (tagging,
summaries, code explanation, prompt optimization).

## Technical Skills

| | |
| --- | --- |
| **Languages** | TypeScript (strict, no `any`), SQL (PostgreSQL), JavaScript, HTML, CSS |
| **Frameworks & libraries** | Next.js 16 (App Router, server components, server actions, route handlers), React 19, NextAuth v5, Zod 4, Tailwind CSS v4, shadcn/ui + Radix, Monaco Editor, react-markdown, cmdk |
| **Databases & data** | PostgreSQL on Neon, Prisma 7 (migrations, interactive transactions, raw SQL where needed), Upstash Redis |
| **Cloud & infrastructure** | Vercel, Cloudflare R2 through the AWS S3 SDK, Neon dev and production branches, Resend email |
| **Payments** | Stripe Checkout, Billing Portal and signature-verified webhooks |
| **AI** | OpenAI Responses API (gpt-5-nano): JSON output, prompt-injection delimiting, per-user rate limits |
| **Testing** | Vitest, mocking at module boundaries, v8 coverage, mutation checks, browser verification with Playwright |
| **Tools** | Git, ESLint, Prisma Studio, Stripe CLI, `tsx` scripts, Claude Code |

### Engineering highlights

- **Authentication** — credentials and GitHub OAuth, email verification and
  password reset with hashed, scoped, single-use tokens. Rate limits cover every
  auth entry point, and sign-in takes the same bcrypt time whether or not the
  email exists.
- **Authorization** — every query is scoped to the session user, and ownership
  is checked in the `WHERE` of the write itself, so there is no gap between the
  check and the write.
- **Billing** — the Stripe webhook verifies signatures and re-reads the
  subscription from Stripe instead of trusting event order. Its writes are
  idempotent, and free-tier limits are enforced on the server inside
  transactions.
- **File storage** — R2 objects are private and served only through an
  ownership-checked route. The content type comes from the file extension,
  with `nosniff` and a sandboxing CSP on every response.
- **AI** — the four AI features are Pro-gated and validated with Zod, and their
  rate limit fails closed so an outage cannot mean unlimited paid calls.
- **Quality** — 1,100+ unit tests covering server actions and utilities, with
  no database or network access. Each new test is checked by breaking the
  source and confirming it fails.
- **UI** — responsive from 320px up, keyboard-operable, with focus returned
  after dialogs and drawers close.

## Stack notes

- Storage is private: `Item.fileUrl` holds an R2 key, never a public URL.
- Monaco is self-hosted from `public/monaco`, so the editor makes no CDN
  requests.
- Dark mode first; Monaco for code, a Write/Preview markdown editor for prose.
- Tests run in Vitest with `environment: 'node'`.

## Getting started

```bash
npm install                 # also runs prisma generate and copies the Monaco bundle
cp .env.example .env        # then fill it in — see below
npm run db:migrate          # apply migrations
npm run db:seed             # demo user, 7 item types, 3 collections, 17 items
npm run dev                 # http://localhost:3000
```

The seed creates `demo@devfetch.site` with password `12345678`.

### Environment

`.env.example` documents every variable. The ones without which the app will
not start or a feature will not work:

- `DATABASE_URL` / `DIRECT_DATABASE_URL` — Neon pooled and unpooled endpoints.
  Migrations need the unpooled one; PgBouncer breaks Prisma Migrate's advisory
  locks.
- `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` — NextAuth.
- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` — verification and password-reset
  email. `APP_URL` supplies the absolute link base rather than the request's
  `Host` header, which a caller controls.
- `UPSTASH_REDIS_REST_URL` / `_TOKEN` — rate limiting. Absent, auth limiting
  is skipped and logged once, while AI requests are refused (they fail closed).
- `R2_*` — uploads.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`,
  `STRIPE_PRICE_ID_YEARLY` — Pro billing. The client is built lazily, so the
  app builds without them.
- `OPENAI_API_KEY` — the AI features.
- `EMAIL_VERIFICATION` — only the literal `off` disables verification on
  register. Unset or misspelled leaves it **on**, so a deploy that forgets the
  variable fails secure.

## Commands

| | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest once (`test:watch`, `test:coverage`) |
| `npm run db:migrate` | `prisma migrate dev` (`:status`, `:deploy`) |
| `npm run db:seed` | Re-runnable seed |
| `npm run db:test` | Read-only health check — connects, times a query, counts every model |
| `npm run db:studio` | Prisma Studio |
| `npm run db:prune-users` | Delete test accounts; dry run unless passed `-- --yes` |

## Layout

```
src/actions      server actions        src/lib/db      Prisma queries (server-only)
src/app          routes and pages      src/lib/auth    tokens, password hashing
src/components   UI, feature-grouped   src/lib/email   Resend senders
src/hooks        shared React hooks    src/types       shared types
src/lib          utilities             src/lib/ai      OpenAI prompts and parsing
prisma/          schema, migrations, seed
context/         project docs Claude reads — see CLAUDE.md
```

## Testing

Vitest covers **server actions and utilities only** — no component tests.
Components are verified in the browser. Tests are co-located as
`src/**/*.test.ts`, always `.ts` and never `.tsx`, so a component test cannot be
collected: the scope is enforced by the include glob rather than by convention.

No test touches the database, Redis or the network. Mock the module boundary
(`@/auth`, `@/lib/prisma`, `@/lib/rate-limit`) and leave the pure modules real,
so an action is tested against the same schemas production runs.
`src/actions/auth.test.ts` is the worked example.

When adding a test, check it can fail: break the source, watch it go red, put
the source back.

## Working on this

`CLAUDE.md` and `context/` hold the conventions — coding standards, the
feature workflow, and `context/current-feature.md`, which is the running
history of every feature and the decisions behind it.
