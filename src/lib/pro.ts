/**
 * Item types reserved for Pro — the two whose content is an uploaded object.
 *
 * `ItemType` has no `isPro` column: which built-ins are Pro is a pricing
 * decision, not a property of the row, and custom types are Pro by definition.
 *
 * A free account is refused both creating one of these and browsing its type
 * page, which renders an upgrade page instead. What it is never refused is
 * reading an item it already holds: `/api/files/[id]` serves an object to
 * whoever owns the item naming it, and those items still appear on `/items`,
 * in search, on `/favorites` and inside their collections. Both types were
 * offered to every account from the day uploads shipped until the day billing
 * did, so hiding content somebody already stored would read as data loss.
 */
const PRO_TYPE_SLUGS = new Set(['file', 'image']);

export function isProType(slug: string): boolean {
  return PRO_TYPE_SLUGS.has(slug);
}

/**
 * Whether this viewer can create an item of this type.
 *
 * Derived from `isProType` rather than listing the types again, so the badge
 * in the sidebar, the disabled option in the new-item dialog and the gate in
 * `createItem` cannot drift onto different sets — the anti-drift rule
 * `usesCodeEditor`, `requiredFieldsFor` and `usesFileList` all follow.
 *
 * A convenience for the UI only. The server re-checks: `POST /api/uploads`
 * refuses before storing anything, and `createItem` refuses before writing the
 * row that would reference it.
 */
export function canCreateType(slug: string, isPro: boolean): boolean {
  return isPro || !isProType(slug);
}

/**
 * Whether this viewer may open this type's own page.
 *
 * Derived from `isProType` for the same anti-drift reason `canCreateType` is,
 * and kept as a separate name rather than an alias of it: they answer
 * different questions — one gates a write, one gates a page — and the day
 * browsing is opened up without opening up uploads, only one of them moves.
 *
 * A page-level gate, not a data one. The items themselves are still readable
 * everywhere else they appear; see the note at the top of this file.
 */
export function canBrowseType(slug: string, isPro: boolean): boolean {
  return isPro || !isProType(slug);
}

/**
 * Where a free account is sent when a Pro gate refuses it.
 *
 * Named here rather than written out at each call site because three of them
 * now exist — the top bar's button, the gated type page's redirect and the
 * checkout copy — and a path typed three times is a path that can be renamed
 * twice. This file already owns what Pro means, so it owns where you go to
 * get it.
 */
export const UPGRADE_PATH = '/upgrade';
