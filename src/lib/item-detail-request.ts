import type { ItemDetail, ItemDetailResponse } from '@/types/item';

/**
 * Fetches one item's full detail for the drawer.
 *
 * Lives here rather than inside `ItemDrawerProvider` so it can be tested:
 * `coding-standards.md` scopes the suite to server actions and utilities, so
 * the parse and the error branches had no coverage while they sat in a
 * component.
 *
 * An `AbortError` is deliberately allowed to propagate rather than being
 * swallowed into a null: the caller has to be able to tell "this request was
 * replaced by a newer one" from "this request failed", because the two mean
 * opposite things for the drawer's state.
 */
export async function fetchItemDetail(id: string, signal?: AbortSignal): Promise<ItemDetail> {
  const response = await fetch(`/api/items/${id}`, { signal });

  // A non-JSON body — an error page, say — rejects here and reaches the
  // caller's catch like any other failure.
  const body = (await response.json()) as ItemDetailResponse;

  if (!response.ok || !body.success) {
    throw new Error(body.success ? 'Could not load the item' : body.error);
  }

  return body.data;
}
