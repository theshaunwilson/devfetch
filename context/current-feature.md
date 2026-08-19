# Current Feature

<!-- Feature Name -->

Dashboard Items — Real Data

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Replace the dummy item data in the dashboard main area (right side) with real data from the Neon database via Prisma. This covers both the Pinned list and the Recent items list. They should look the way they do now, but sourced from the database instead of `@src/lib/mock-data.ts`. Requirements from `@context/features/dashboard-items-spec.md`:

- Create `src/lib/db/items.ts` with the data fetching functions
- Fetch items directly in the server component
- Item card icon/border derived from the item type
- Display item type tags and everything else currently rendered — reference `@docs/images/dashboard.png` if needed
- Update the stats display
- If there are no pinned items, that section renders nothing

## Notes

<!-- Any extra notes -->

- **`getCurrentUserId()` moved to `src/lib/db/user.ts`** and `collections.ts` now imports it. It was private to `collections.ts`; a second copy in `items.ts` would mean its own `cache` entry and a second user lookup per request. One shared module keeps the dashboard at a single lookup for all five queries.
- **`src/lib/db/items.ts`** exposes `getPinnedItems()`, `getRecentItems(limit)` and `getItemStats()`. All three return empty results when the demo user is missing, matching `collections.ts`.
- **One shared `ITEM_SELECT`** covers everything a row renders — type (`id`/`name`/`icon`/`color`) and tag names — so both list queries return the same shape and `toDashboardItem` is the only mapping. Typed with `satisfies Prisma.ItemSelect` so `Prisma.ItemGetPayload` can derive the row type; without it the `true` literals widen to `boolean` and inference breaks.
- **Tags are ordered `tag.name` ascending.** `ItemTag` join rows have no natural order, so without an `orderBy` the badge order can shift between loads.
- **`getPinnedItems()` takes no limit** — the page has never truncated the Pinned list, and pinning is deliberate so the list stays short. Worth revisiting if it ever grows.
- **`updatedAt` is serialized to an ISO string in the db layer** so `formatShortDate` and `ItemRow` stay untouched.
- **`ItemRow` reads `item.type` directly** instead of looking the type up in `itemTypes` from mock data. Its description is now guarded, since `Item.description` is nullable in the schema and the mock type was not.
- **Stat tiles are fully live** — `DashboardStats` takes `items` alongside `collections` and no longer imports mock data.
- **The page runs five queries in one `Promise.all`** (collections, collection stats, pinned, recent, item stats), all sharing the cached user lookup.
- Sidebar is the last mock-data consumer left (`itemTypes`, `collections`, `currentUser`) — out of scope here.
- Verified against the Neon dev branch through the running dev server: stat tiles read 18 / 5 / 5 / 2, three pinned rows in `updatedAt desc` order, ten recent rows matching a direct Prisma query row for row, and each row's border, icon tile tint and lucide icon resolving to its own type (command → orange/Terminal, prompt → violet/Sparkles, snippet → blue/Code, url → emerald/Link). The empty-pinned path was checked by temporarily forcing `getPinnedItems()` to return nothing — the whole section including its heading disappears — then reverted. `npm run lint` and `npm run build` both clean.

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
- Dashboard items from the database — the dashboard's Pinned and Recent lists and the two item stat tiles now read Neon through Prisma, leaving the sidebar as the only mock-data consumer. `src/lib/db/items.ts` exposes `getPinnedItems()`, `getRecentItems(limit)` and `getItemStats()`. `getCurrentUserId()` moved out of `collections.ts` into `src/lib/db/user.ts` so both modules share one cached lookup instead of each holding its own `cache` entry and querying the user twice per request. One shared `ITEM_SELECT` — typed `satisfies Prisma.ItemSelect` so `Prisma.ItemGetPayload` can derive the row type — covers the item type and tag names both lists need, with tags ordered by name because `ItemTag` join rows have no natural order. `getPinnedItems()` is unlimited, matching the page which has never truncated Pinned; Recent stays at 10. `updatedAt` is serialized to ISO in the db layer so `formatShortDate` and `ItemRow` stay untouched. `ItemRow` now reads `item.type` directly rather than looking it up in mock `itemTypes`, and guards its description since `Item.description` is nullable. The page runs five queries in one `Promise.all`. Verified against the seeded Neon branch: tiles at 18/5/5/2, pinned and recent matching a direct Prisma query row for row, per-type borders and icon tints resolving correctly, and the Pinned section disappearing entirely when there are no pinned items
