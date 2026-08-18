# Current Feature

<!-- Feature Name -->

Seed Data

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Create `prisma/seed.ts` to populate the database with sample data for development and demos. Requirements from `@context/features/seed-spec.md`:

- **User** — `demo@devfetch.io`, name "Demo User", password `12345678` hashed with bcryptjs at 12 rounds, `isPro: false`, `emailVerified` set to the current date
- **7 system item types** (all `isSystem: true`), with Lucide React icon names and colors:

  | Name    | Icon       | Color   |
  | ------- | ---------- | ------- |
  | snippet | Code       | #3b82f6 |
  | prompt  | Sparkles   | #8b5cf6 |
  | command | Terminal   | #f97316 |
  | note    | StickyNote | #fde047 |
  | file    | File       | #6b7280 |
  | image   | Image      | #ec4899 |
  | link    | Link       | #10b981 |

- **5 collections holding 18 items total**:
  - *React Patterns* ("Reusable React patterns and hooks") — 3 TypeScript snippets: custom hooks (useDebounce, useLocalStorage), component patterns (context providers, compound components), utility functions
  - *AI Workflows* ("AI prompts and workflow automations") — 3 prompts: code review, documentation generation, refactoring assistance
  - *DevOps* ("Infrastructure and deployment resources") — 1 snippet (Docker / CI-CD config), 1 command (deployment script), 2 links (real documentation URLs)
  - *Terminal Commands* ("Useful shell commands for everyday development") — 4 commands: git operations, docker, process management, package manager utilities
  - *Design Resources* ("UI/UX resources and references") — 4 links (real URLs): CSS/Tailwind references, component libraries, design systems, icon libraries
- All link URLs must be real, working destinations

## Notes

<!-- Any extra notes -->

Decisions taken while implementing the open questions flagged during planning:

- **System item types stay global** (`userId: null`) so they are shared by every user. Because Postgres treats NULLs as distinct, `@@unique([userId, slug])` cannot dedupe them, so `seedSystemItemTypes` matches on `slug` explicitly and updates in place rather than upserting. Re-running produces 7 types, not 14.
- **Re-runnable via `deleteMany` on the demo user**, which cascades to their items, collections, tags and join rows. System types survive that delete and are updated separately.
- **Slugs are the spec's singular names** (`snippet`, `prompt`, …) rather than the plural labels in `lib/mock-data.ts`. Nothing routes to `/items/[slug]` yet, so there is no conflict to resolve until the UI moves off mock data.
- **Collection colors** were not in the spec and are drawn from the type palette: React Patterns `#3b82f6`, AI Workflows `#8b5cf6`, DevOps `#f97316`, Terminal Commands `#10b981`, Design Resources `#ec4899`. React Patterns and Terminal Commands are marked `isFavorite` so the sidebar's favorites section has content.
- **Tags are included** — 27 unique tags across 38 `ItemTag` rows — even though the spec does not mention them, so the join table has real data to query. 3 items are pinned and 5 favorited so the dashboard's Pinned and favorite tiles are not empty.
- **Prisma 7 seeding is explicit**: registered as `migrations.seed` in `prisma.config.ts` and run via `npm run db:seed`. It does not fire automatically after `migrate dev` or `migrate reset`.
- `bcryptjs` v3 ships its own type definitions, so no `@types/bcryptjs`.
- Verified against the Neon dev branch: the stored hash verifies against `12345678` at cost 12, collection composition matches the spec exactly (3/3/4/4/4 = 18 items), and all six seeded URLs return 200.
- `scripts/test-db.ts` (`npm run db:test`) now prints the seeded data as well as the row counts: item types with their icon, color and item count, the demo user's flags and bcrypt cost, and every collection with its items, favorite/pinned markers and tags. Still read-only. It reports what to run when the demo user is absent rather than failing, and keeps `DEMO_EMAIL` as a local constant because importing `prisma/seed.ts` would execute the seed.
- Seed only ever runs against the development branch. Do not point it at production.


## History

<!-- Keep this updated. Earliest to latest -->

- Initial Next.js 16 setup (React 19, TypeScript, Tailwind CSS v4, ESLint) via create-next-app
- Project setup and boilerplate cleanup
- Mock data source added for the dashboard UI
- Dashboard UI Phase 1 — ShadCN init, `/dashboard` route, dashboard layout shell, dark mode by default, display-only top bar, sidebar/main placeholders
- Dashboard UI Phase 2 — collapsible sidebar built from mock data: item types linking to `/items/[slug]`, favorite and recent collections, user area, and a "Navigation" row holding the collapse toggle on desktop / the close X in the mobile drawer. Sidebar state lives in `SidebarProvider`; the top bar shows a hamburger below `md` and only shows the panel toggle while the sidebar is collapsed. The DevFetch brand moves to the top bar below `md`
- Dashboard UI Phase 3 — dashboard main area built from mock data: 4 stat tiles (items, collections, favorite items, favorite collections) counted from the mock arrays, a Collections grid of the 6 most recently updated collections linking to `/collections/[id]` with a "View all" link, a Pinned list, and the 10 most recent items. Pinned and Recent rows share `ItemRow`; type/collection hex colors map to Tailwind classes in `lib/colors.ts` (`borderColorClass`, `softBgColorClass`) and dates format in UTC via `lib/format.ts`. Item rows are not links yet — no item detail route exists — and collection cards omit the screenshot's "…" menu until collection actions exist
- Prisma + Neon PostgreSQL — Prisma 7 wired to a Neon dev branch. Schema covers the DevFetch domain (User, Item, ItemType, Collection, Tag, ItemTag) plus Auth.js models (Account, Session, VerificationToken), with indexes on the dashboard query paths and explicit delete rules (Cascade from `User`, `SetNull` on `Collection`, `Restrict` on `ItemType`). Prisma 7 moves connection settings into `prisma.config.ts`, requires an explicit generator `output` (`src/generated/prisma`, gitignored), no longer loads `.env` itself, and requires a driver adapter — `PrismaNeon` over `@neondatabase/serverless`. Migrations use `DIRECT_DATABASE_URL` (Neon's unpooled endpoint) because PgBouncer breaks Prisma Migrate's advisory locks; the app uses the pooled `DATABASE_URL`. Initial migration `20260818212450_init` applied and verified with a live round-trip covering relations and both delete rules. Dashboard still renders from mock data
- Database health check script — `scripts/test-db.ts` (`npm run db:test`) connects through the app's own Prisma client, times a `SELECT 1` and counts every model, so a table the client expects but the database lacks fails loudly. Read-only, so it is safe against any branch. Loads `.env.local` then `.env` via dotenv and imports the client dynamically, because `src/lib/prisma.ts` reads `DATABASE_URL` at import time and static imports hoist above the dotenv calls. Errors run through a `messageOf` helper since Neon's WebSocket driver rejects with a DOM-style `ErrorEvent` rather than an `Error`
- Seed data — `prisma/seed.ts` (`npm run db:seed`) populates the dev branch with the demo user `demo@devfetch.io` (password `12345678`, bcrypt cost 12, `isPro: false`), 7 global system item types, 5 collections and 18 items, plus 27 tags across 38 `ItemTag` rows. Re-runnable: the demo user is deleted first and cascades, while global system types (`userId: null`) are matched on `slug` and updated in place, since Postgres treats NULLs as distinct and `@@unique([userId, slug])` cannot dedupe them. Prisma 7 dropped auto-seeding, so the command is registered as `migrations.seed` in `prisma.config.ts` and never fires from `migrate dev`/`reset`. `scripts/test-db.ts` extended to print the seeded data — item types with counts, the demo user's flags and bcrypt cost, and every collection with its items, favorite/pinned markers and tags — still read-only, and it hints at `db:seed` instead of failing when the demo user is absent. Verified against the Neon dev branch: hash verifies at cost 12, collection composition matches the spec (3/3/4/4/4), and all six seeded URLs return 200
