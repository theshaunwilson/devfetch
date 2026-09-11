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
 * A collection as offered by the item forms' collections picker.
 *
 * Name and id only: the picker draws a checkbox row per collection and files
 * the item by id. It deliberately carries no counts, so it needs none of the
 * per-collection aggregation the dashboard and sidebar lists pay for.
 */
export interface CollectionOption {
  id: string;
  name: string;
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
