/**
 * Item types reserved for Pro. Free accounts can still browse them, so this is
 * only used to mark the types in the UI — gating lands with billing.
 *
 * `ItemType` has no `isPro` column: which built-ins are Pro is a pricing
 * decision, not a property of the row, and custom types are Pro by definition.
 */
const PRO_TYPE_SLUGS = new Set(['file', 'image']);

export function isProType(slug: string): boolean {
  return PRO_TYPE_SLUGS.has(slug);
}
