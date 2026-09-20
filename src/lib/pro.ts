/**
 * Item types reserved for Pro — the two whose content is an uploaded object.
 *
 * `ItemType` has no `isPro` column: which built-ins are Pro is a pricing
 * decision, not a property of the row, and custom types are Pro by definition.
 *
 * Free accounts can still **browse** these types and open the items they
 * already hold. That distinction is the whole of the upload gate's policy:
 * creation is refused, reading never is, because both types were offered to
 * every account from the day uploads shipped until the day billing did.
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
