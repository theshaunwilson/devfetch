/** Item type an item belongs to, drawn as its icon tile and left border. */
export interface DashboardItemType {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/** An item as rendered in the dashboard's Pinned and Recent lists. */
export interface DashboardItem {
  id: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  /** ISO string — the row formats it with `formatShortDate` */
  updatedAt: string;
  type: DashboardItemType;
  /** Tag names, alphabetical */
  tags: string[];
}

/** Item counts shown in the dashboard stat tiles. */
export interface ItemStats {
  total: number;
  favorites: number;
}

/** Item type as rendered in the sidebar's Types list. */
export interface SidebarItemType {
  id: string;
  name: string;
  /** Used for the /items/[slug] link */
  slug: string;
  icon: string | null;
  color: string | null;
  itemCount: number;
}

/** One item type together with the current user's items of that type. */
export interface ItemsByType {
  type: DashboardItemType;
  items: DashboardItem[];
}

/** Collection an item belongs to, drawn as a badge in the detail drawer. */
export interface ItemDetailCollection {
  id: string;
  name: string;
}

/**
 * An item as rendered in the detail drawer: everything a card already knows,
 * plus the fields only the drawer shows.
 */
export interface ItemDetail extends DashboardItem {
  content: string | null;
  language: string | null;
  collection: ItemDetailCollection | null;
  /** ISO string, like `updatedAt` */
  createdAt: string;
}

/** What `GET /api/items/[id]` returns. Shared by the route and the drawer. */
export type ItemDetailResponse =
  | { success: true; data: ItemDetail }
  | { success: false; error: string };
