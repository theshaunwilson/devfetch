import type { Pagination } from '@/types/pagination';

/** Item type present in a collection, rendered as a small icon on its card. */
export interface CollectionItemType {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/** A collection as rendered in the dashboard grid. */
export interface DashboardCollection {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  /** Types held by the collection, most used first */
  types: CollectionItemType[];
  /** Color of the most used type, drawn as the card's left border */
  accentColor: string | null;
}

/**
 * A collection as rendered on the `/favorites` list.
 *
 * Deliberately narrower than `DashboardCollection`: the compact row draws a
 * folder icon, the name and a date, so it needs neither the description, the
 * item count nor the type mix — which is what lets its query skip the
 * type-usage aggregation every card-shaped read pays for.
 */
export interface FavoriteCollection {
  id: string;
  name: string;
  /** ISO string — the row formats it with `formatShortDate` */
  updatedAt: string;
}

/** One page of the `/collections` index, with where in the list it sits. */
export interface PaginatedCollections {
  collections: DashboardCollection[];
  pagination: Pagination;
}

/**
 * A collection reduced to what a picker or the command palette needs.
 *
 * The item forms draw a checkbox row per collection and file the item by id,
 * so they use the name and the id alone. The palette shows the item count
 * beside the name, which is why this carries one — a reversal of the note that
 * stood here before, when nothing needed it. It is a `_count` on the join
 * rather than the per-collection type aggregation the dashboard and sidebar
 * pay for, and both callers are served by one cached query instead of two
 * reads of the same rows.
 */
export interface CollectionOption {
  id: string;
  name: string;
  /** How many items are filed in it. */
  itemCount: number;
}

/** Collection counts shown in the dashboard stat tiles. */
export interface CollectionStats {
  total: number;
  favorites: number;
}

/** A collection as rendered in the sidebar's Collections list. */
export interface SidebarCollection {
  id: string;
  name: string;
  itemCount: number;
  /** Color of the most used type, drawn as the row's dot */
  accentColor: string | null;
}

/** Sidebar collections, split into the two groups the list renders. */
export interface SidebarCollections {
  favorites: SidebarCollection[];
  recent: SidebarCollection[];
}

/**
 * What `createCollection` in `@/lib/db/collections` reports back.
 *
 * A duplicate name is its own outcome rather than a thrown error, because it
 * is a field error the form has to render — and the unique index is what
 * actually decides it, so it can only be known here, at the write.
 */
export type CreateCollectionOutcome =
  | { ok: true; collection: DashboardCollection }
  | { ok: false; reason: 'no-session' | 'duplicate-name' };

/**
 * What the `createCollection` server action returns. The new collection comes
 * back in full, on the same contract as the item actions, so a caller has the
 * saved row rather than only the fact that something was written.
 */
export type CreateCollectionResult =
  | { success: true; data: DashboardCollection }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * A collection reduced to the metadata its edit dialog and delete confirmation
 * need: the id that addresses it, and the two fields a user can change.
 *
 * `DashboardCollection` is a superset, so a card can hand one straight over.
 */
export interface CollectionMeta {
  id: string;
  name: string;
  description: string | null;
}

/**
 * What `updateCollection` in `@/lib/db/collections` reports back.
 *
 * `not-found` covers both an id that names nothing and one that names somebody
 * else's collection, because the update's own `where` clause is what decides
 * it and the two are indistinguishable from outside.
 *
 * Nothing comes back on success. A metadata edit cannot change a collection's
 * item count, type mix or accent colour, so returning a full
 * `DashboardCollection` would mean running the type-usage aggregation purely to
 * satisfy a shape — and the caller refreshes the surfaces it appears on anyway.
 */
export type UpdateCollectionOutcome =
  | { ok: true }
  | { ok: false; reason: 'no-session' | 'duplicate-name' | 'not-found' };

/**
 * What the `updateCollection` server action returns. A duplicate name comes
 * back on the field, as it does for a create: it is the one failure the user
 * can fix by editing what they typed.
 */
export type UpdateCollectionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * What `deleteCollection` returns. Nothing on success — the row is gone, and
 * the caller either navigates away or refreshes.
 */
export type DeleteCollectionResult = { success: true } | { success: false; error: string };
