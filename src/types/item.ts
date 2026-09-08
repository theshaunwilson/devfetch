/** Item type an item belongs to, drawn as its icon tile and left border. */
export interface DashboardItemType {
  id: string;
  name: string;
  /**
   * The stable identifier for the type, unlike `name`, which is user-facing
   * text a custom type could reuse. Cards decide from it — whether a copy
   * button has anything to copy — and the edit form picks its type-specific
   * fields from it.
   */
  slug: string;
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
  /**
   * The stored object's key, not a URL, despite the column's name: uploads are
   * private, so they are read back through `/api/files/[id]` rather than from
   * the bucket. Present only on file and image items.
   *
   * A card never uses the key itself, only whether there is one — which is
   * what tells an image gallery to draw a thumbnail rather than a placeholder.
   */
  fileUrl: string | null;
  /** The uploader's own filename, shown and used as the download name. */
  fileName: string | null;
  /** Bytes. Present only on file and image items. */
  fileSize: number | null;
  /**
   * ISO string. The row was created when its file was uploaded — an item's
   * file cannot be replaced later — so this is the upload date a file list
   * shows, which `updatedAt` is not: that moves on every title or tag edit.
   */
  createdAt: string;
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
  url: string | null;
  /** `type`, `fileUrl`, `fileName`, `fileSize` and `createdAt` are inherited. */
  collection: ItemDetailCollection | null;
}

/** What `GET /api/items/[id]` returns. Shared by the route and the drawer. */
export type ItemDetailResponse =
  | { success: true; data: ItemDetail }
  | { success: false; error: string };

/**
 * What `updateItem` returns. The updated item comes back in full so the drawer
 * can refresh itself without a second fetch.
 *
 * `fieldErrors` carries Zod's per-field messages; `error` is always set on a
 * failure, so a caller that only shows one message still has something to say.
 */
export type UpdateItemResult =
  | { success: true; data: ItemDetail }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * What `deleteItem` returns. Nothing comes back on success — the row is gone,
 * and the drawer closes rather than redrawing anything.
 */
export type DeleteItemResult = { success: true } | { success: false; error: string };

/**
 * An item type reduced to what a create needs: the id to file the item under,
 * and the slug that says which fields that type requires.
 */
export interface ItemTypeRef {
  id: string;
  slug: string;
}

/**
 * What `createItem` returns. The new item comes back in full, on the same
 * contract as `updateItem`, so a caller has the saved row rather than only the
 * fact that something was written.
 */
export type CreateItemResult =
  | { success: true; data: ItemDetail }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * What the download proxy needs: the object to fetch, the name to serve it
 * under, and the type slug that says which media type it is.
 */
export interface ItemFile {
  key: string;
  fileName: string;
  fileSize: number | null;
  typeSlug: string;
}

/**
 * How an item stores its body. Follows from the item's type — file and image
 * items hold an uploaded object, everything else holds text — so it is decided
 * on the server and never sent by a caller.
 */
export type ItemContentType = 'text' | 'file';

/**
 * What deleting an item leaves the caller to do: whether the row was theirs to
 * delete, and the object key to remove from storage if it had one.
 */
export interface DeletedItem {
  deleted: boolean;
  fileKey: string | null;
}
