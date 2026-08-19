# Current Feature

<!-- Feature Name -->

Dashboard Collections — Real Data

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Replace the dummy collection data in the dashboard main area (right side) with real data from the Neon database via Prisma. The 6 recent-collection cards should look the way they do now, but sourced from the database instead of `@src/lib/mock-data.ts`. Requirements from `@context/features/dashboard-collections-spec.md`:

- Create `src/lib/db/collections.ts` with the data fetching functions
- Fetch collections directly in the server component
- Collection card border color derived from the most-used content type in that collection
- Show small icons of all types present in that collection
- Keep the current design — reference `@docs/images/dashboard.png` if needed
- Update the collection stats display

Out of scope: the items list underneath the collections grid stays on mock data for now.

## Notes

<!-- Any extra notes -->

- **`src/lib/db/collections.ts`** exposes `getRecentCollections(limit)` and `getCollectionStats()`. Both resolve the user through a `getCurrentUserId()` helper wrapped in React's `cache` so the page's two parallel queries share one lookup. There is no auth yet, so it resolves the seeded `demo@devfetch.io` user; that helper is the seam NextAuth replaces. Missing demo user returns empty results rather than throwing.
- **Three queries, no item rows.** Collections are fetched with `take`/`orderBy updatedAt desc`, then `prisma.item.groupBy({ by: ['collectionId', 'typeId'], _count: { _all: true } })` gives per-collection totals and the type mix without pulling item rows into the response, then the referenced `ItemType` rows are fetched once. `collectionId` is nullable on `Item`, so the assembly loop skips nulls even though the `where` excludes them.
- **Border color comes from the most-used type**, not the collection's own `color` — per the spec. Type icons are ordered by count desc, then name, so the order is stable. `Collection.color` is now unused on the dashboard; it stays on the model for the sidebar and future collection pages.
- **`export const dynamic = 'force-dynamic'`** on `/dashboard`, otherwise Next tries to prerender it at build time and the build needs a live database.
- **`lib/colors.ts` and `lib/icons.ts` extended** to cover the seeded palette (`#8b5cf6`, `#10b981`, `#fde047`, `#6b7280`) and icon names (`Code`, `Terminal`, `StickyNote`), which the mock data never used. All three lookup helpers now accept `string | null | undefined` because `ItemType.icon`/`color` are nullable in the schema.
- **Stat tiles are mixed**: Collections and Favorite Collections are live, Items and Favorite Items still read `lib/mock-data.ts` until items move over.
- Sidebar, Pinned and Recent sections are untouched and still render from mock data.
- Verified against the Neon dev branch via the running dev server: 5 cards in `updatedAt desc` order with counts 4/4/4/3/3 matching the seed, favorites starred on Terminal Commands and React Patterns, borders resolving to the most-used type's color (DevOps → link/emerald, not its own orange), and DevOps showing three type icons ordered link, command, snippet. `npm run lint` and `npm run build` both clean.


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
- Dashboard collections from the database — the dashboard's Collections grid and its two collection stat tiles now read Neon through Prisma instead of `lib/mock-data.ts`. `src/lib/db/collections.ts` exposes `getRecentCollections(limit)` and `getCollectionStats()`; both resolve the user through a `getCurrentUserId()` helper wrapped in React's `cache`, which returns the seeded `demo@devfetch.io` user until NextAuth lands and returns empty results if that user is absent. Three queries per load: collections by `updatedAt desc`, `item.groupBy({ by: ['collectionId', 'typeId'], _count })` for totals and type mix without pulling item rows, then the referenced `ItemType` rows. Card border color is derived from the most-used type rather than `Collection.color`, and type icons are ordered by count then name. `/dashboard` is `force-dynamic` so the build does not need a live database. `lib/colors.ts` and `lib/icons.ts` gained the seeded palette (`#8b5cf6`, `#10b981`, `#fde047`, `#6b7280`) and icon names (`Code`, `Terminal`, `StickyNote`), and their lookups accept null since `ItemType.icon`/`color` are nullable. Sidebar, Pinned, Recent and the two item stat tiles still render from mock data
