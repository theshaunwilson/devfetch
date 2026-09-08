# DevFetch

A developer knowledge hub for snippets, commands, prompts, notes, files, images
and links — one searchable place instead of a dozen scattered ones.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript, strict |
| Database | Neon PostgreSQL + Prisma 7 |
| Auth | NextAuth v5 — credentials and GitHub |
| Storage | Cloudflare R2 (private; served through an app route) |
| Rate limiting | Upstash Redis |
| Email | Resend |
| UI | Tailwind CSS v4 + shadcn/ui, dark mode first |
| Editors | Monaco for code, a Write/Preview markdown editor for prose |
| Tests | Vitest (`environment: 'node'`) |

## Getting started

```bash
npm install                 # also runs prisma generate and copies the Monaco bundle
cp .env.example .env        # then fill it in — see below
npm run db:migrate          # apply migrations
npm run db:seed             # demo user, 7 item types, 5 collections, 18 items
npm run dev                 # http://localhost:3000
```

The seed creates `demo@devfetch.io` with password `12345678`.

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
- `UPSTASH_REDIS_REST_URL` / `_TOKEN` — auth rate limiting. Absent, limiting is
  skipped and logged once rather than per request.
- `R2_*` — uploads.
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
src/lib          utilities             prisma/         schema, migrations, seed
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
