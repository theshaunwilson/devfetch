# Current Feature

<!-- Feature Name -->

Prisma + Neon PostgreSQL Setup

## Status

<!-- Not Started|In Progress|Completed -->

In Progress

## Goals

<!-- Goals & requirements -->

Set up Prisma ORM (v7) against a Neon PostgreSQL serverless database. Requirements from `@context/features/database-spec.md`:

- Use Neon PostgreSQL (serverless)
- Use **Prisma 7** — it has breaking changes, so read the upgrade guide (https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) and the Prisma Postgres quickstart (https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/prisma-postgres) before implementing
- Create the initial schema from the data models in `@context/project-overview.md` (User, Item, ItemType, Collection, Tag, ItemTag) — this schema will evolve
- Include NextAuth models: Account, Session, VerificationToken
- Add appropriate indexes and cascade deletes
- Always create migrations (`prisma migrate dev`); never `db push` unless explicitly specified
- Verify with `prisma migrate status` and a passing `npm run build`

## Notes

<!-- Any extra notes -->

- **Prisma 7 differences that shaped the setup**: the `prisma-client-js` provider is deprecated in favour of `prisma-client` and `output` is now required, so the client generates to `src/generated/prisma` (gitignored, eslint-ignored) and is imported as `@/generated/prisma/client`. Connection settings moved out of `schema.prisma` into `prisma.config.ts` — the `datasource db` block only declares `provider`. Prisma no longer loads `.env` itself, so `prisma.config.ts` loads `dotenv` explicitly (`.env.local` first, then `.env`, matching Next.js precedence). Driver adapters are mandatory. The CLI no longer auto-generates, so `prisma generate` runs from both `build` and `postinstall`.
- **Neon connections**: `DATABASE_URL` is the pooled endpoint used by the app at runtime through `PrismaNeon` + `@neondatabase/serverless` (WebSocket transport; `ws` is only installed as a polyfill for runtimes below Node 22). `DIRECT_DATABASE_URL` is the same host without `-pooler` and is what `prisma.config.ts` hands to the CLI, because Prisma Migrate needs advisory locks that Neon's PgBouncer transaction pooler does not support. Both are documented in `.env.example`.
- **Cascade behaviour** (verified against the live dev branch): deleting a `User` cascades to items, item types, collections, tags and join rows; deleting a `Collection` sets `Item.collectionId` to null rather than removing the item; `Item.type` is `Restrict` so a type cannot be deleted out from under its items.
- **Schema deviations from the project-overview draft**, all to match code that already exists: `ItemType.slug` (the sidebar links to `/items/[slug]`), `Collection.color` (collection cards render it), and `name` / `emailVerified` / `image` on `User` for the Auth.js adapter. `Item.contentType` stays a `String` as drafted; an enum is a candidate once the values settle.
- Dashboard UI still reads from `lib/mock-data.ts`; swapping it to Prisma queries is a separate feature.

## History

<!-- Keep this updated. Earliest to latest -->

- Initial Next.js 16 setup (React 19, TypeScript, Tailwind CSS v4, ESLint) via create-next-app
- Project setup and boilerplate cleanup
- Mock data source added for the dashboard UI
- Dashboard UI Phase 1 — ShadCN init, `/dashboard` route, dashboard layout shell, dark mode by default, display-only top bar, sidebar/main placeholders
- Dashboard UI Phase 2 — collapsible sidebar built from mock data: item types linking to `/items/[slug]`, favorite and recent collections, user area, and a "Navigation" row holding the collapse toggle on desktop / the close X in the mobile drawer. Sidebar state lives in `SidebarProvider`; the top bar shows a hamburger below `md` and only shows the panel toggle while the sidebar is collapsed. The DevFetch brand moves to the top bar below `md`
- Dashboard UI Phase 3 — dashboard main area built from mock data: 4 stat tiles (items, collections, favorite items, favorite collections) counted from the mock arrays, a Collections grid of the 6 most recently updated collections linking to `/collections/[id]` with a "View all" link, a Pinned list, and the 10 most recent items. Pinned and Recent rows share `ItemRow`; type/collection hex colors map to Tailwind classes in `lib/colors.ts` (`borderColorClass`, `softBgColorClass`) and dates format in UTC via `lib/format.ts`. Item rows are not links yet — no item detail route exists — and collection cards omit the screenshot's "…" menu until collection actions exist
