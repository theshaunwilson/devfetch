/**
 * Sorting for the `/favorites` list.
 *
 * Client-side: the page's two queries are untouched and the rows it already
 * fetched are reordered in the browser, so changing the sort costs no request
 * and no navigation. No `server-only` — the control that drives this runs on
 * the client, and so does everything here.
 */

/** The keys the sort control offers. */
export type FavoriteSortKey = 'name' | 'date' | 'type';

export type FavoriteSortDirection = 'asc' | 'desc';

export interface FavoriteSort {
  key: FavoriteSortKey;
  direction: FavoriteSortDirection;
}

/** The keys on offer, with the labels the control shows for them. */
export const FAVORITE_SORT_OPTIONS = [
  { id: 'date', label: 'Date' },
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Item type' },
] as const satisfies readonly { id: FavoriteSortKey; label: string }[];

/**
 * Date, newest first.
 *
 * This is what both queries already order by, so the page opens on exactly the
 * order it rendered before the control existed — the default is the status quo
 * rather than a new opinion.
 */
export const DEFAULT_FAVORITE_SORT: FavoriteSort = { key: 'date', direction: 'desc' };

/**
 * Locale pinned to `en-US`, for the same reason `formatShortDate` pins it.
 *
 * The list is a client component, so it is server-rendered and then hydrated:
 * a comparison that read the ambient locale could order the rows one way on
 * the server and another in the browser, which React reports as a hydration
 * mismatch. `numeric` so "Step 2" sorts before "Step 10" rather than after it.
 */
const COLLATOR = new Intl.Collator('en-US', { numeric: true });

/**
 * What a row is reduced to before it is compared. Each list says how to read
 * its own three fields, so the comparison rules — the tie-breaks, the
 * direction — live here once rather than once per list.
 */
interface SortableFavorite {
  id: string;
  name: string;
  /** ISO string. */
  date: string;
  /** The item type's name. Empty for a collection, which has no type. */
  type: string;
}

/**
 * Plain comparison, for values nobody reads as text: ISO timestamps and ids.
 *
 * ISO strings out of the db layer are always `toISOString()` output — a fixed
 * width, always UTC — so comparing them as text orders them as dates. Parsing
 * them first would buy nothing and would turn an unparseable value into `NaN`,
 * which silently corrupts a sort rather than merely misplacing one row.
 */
function compareRaw(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function compareFavorites(a: SortableFavorite, b: SortableFavorite, sort: FavoriteSort): number {
  let primary: number;
  if (sort.key === 'date') {
    primary = compareRaw(a.date, b.date);
  } else if (sort.key === 'type') {
    primary = COLLATOR.compare(a.type, b.type);
  } else {
    primary = COLLATOR.compare(a.name, b.name);
  }

  // Every sort ends in the same two tie-breaks, so rows that compare equal on
  // the chosen key hold a defined order rather than whichever order the
  // database happened to return. Not hypothetical: three favorited items share
  // an identical `updatedAt`. The id is the last resort, since two items can
  // legitimately carry the same title and a cuid is unique.
  const ordered = primary || COLLATOR.compare(a.name, b.name) || compareRaw(a.id, b.id);

  // The direction flips the whole chain rather than the primary key alone, so
  // the arrow means "reverse this list" and no part of it stays sorted the
  // other way.
  return sort.direction === 'desc' ? -ordered : ordered;
}

/**
 * Sorts a list by projecting each row to the fields the comparison needs.
 *
 * Decorate-sort-undecorate rather than projecting inside the comparator, which
 * would re-read the same row on every comparison. Returns a new array: the
 * rows arrive as a prop from a server component, and sorting a prop in place
 * mutates something this component does not own.
 */
function sortFavorites<T>(
  rows: readonly T[],
  toFields: (row: T) => SortableFavorite,
  sort: FavoriteSort,
): T[] {
  return rows
    .map((row) => ({ row, fields: toFields(row) }))
    .sort((a, b) => compareFavorites(a.fields, b.fields, sort))
    .map((entry) => entry.row);
}

/**
 * Favorited items in the chosen order. Generic over the shape rather than
 * taking `DashboardItem`, the way `groupItemsByShape` is: the comparison needs
 * four fields of the twelve a card carries.
 */
export function sortFavoriteItems<
  T extends { id: string; title: string; updatedAt: string; type: { name: string } },
>(items: readonly T[], sort: FavoriteSort): T[] {
  return sortFavorites(
    items,
    (item) => ({
      id: item.id,
      name: item.title,
      date: item.updatedAt,
      type: item.type.name,
    }),
    sort,
  );
}

/**
 * Favorited collections in the chosen order.
 *
 * A collection has no item type, so every collection compares equal under the
 * type key and the shared name tie-break decides — which is how "type falls
 * back to name for collections" is reached: out of the comparison chain that
 * already exists, rather than a branch of its own that could drift from it.
 */
export function sortFavoriteCollections<T extends { id: string; name: string; updatedAt: string }>(
  collections: readonly T[],
  sort: FavoriteSort,
): T[] {
  return sortFavorites(
    collections,
    (collection) => ({
      id: collection.id,
      name: collection.name,
      date: collection.updatedAt,
      type: '',
    }),
    sort,
  );
}
