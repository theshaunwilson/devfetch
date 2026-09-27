/**
 * What a server action returns when it has nothing to hand back on success —
 * a delete, or a write that set a value the caller already knows. Only whether
 * it happened, and why not when it did not.
 *
 * The per-action result names (`DeleteItemResult`, `SetItemFavoriteResult` and
 * the rest) are aliases of this rather than copies of it, so they cannot drift
 * apart by accident — and one can still diverge on purpose by redefining its
 * alias, without a rename at every call site.
 */
export type ActionResult = { success: true } | { success: false; error: string };
