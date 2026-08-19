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
