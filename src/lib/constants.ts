/**
 * The id on the app shell's `<main>`.
 *
 * Shared because two components need to agree on it: `AppShell` puts it on the
 * element, and the item drawer focuses that element when the card it would
 * otherwise return focus to has been deleted.
 */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * The tallest either content editor grows before it scrolls instead.
 *
 * Shared because the code editor and the markdown editor sit next to each
 * other in the same drawer, and a ceiling that differed between them would
 * show as one panel outgrowing the other.
 */
export const EDITOR_MAX_HEIGHT = 400;

/**
 * Items on one page of `/items/[type]` and of `/collections/[id]`.
 *
 * 21 divides by 3 and by 1, which is what both grids resolve to at their
 * widest and narrowest — so a full page never leaves a short final row at
 * `xl` or on a phone. At `md` (two columns) the last row holds one card,
 * which no single number avoids across three column counts.
 */
export const ITEMS_PER_PAGE = 21;

/** Collections on one page of `/collections`. Same grid, so the same size. */
export const COLLECTIONS_PER_PAGE = 21;

/**
 * Collections in the dashboard's Collections section.
 *
 * A preview of `/collections` rather than a page of it — there is no way to
 * reach a second six from the dashboard, and "View all" is what goes to the
 * paged index.
 */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;

/** Items in the dashboard's Recent section. A preview, as above. */
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;
