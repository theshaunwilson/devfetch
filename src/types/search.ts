import type { DashboardItem } from '@/types/item';

/**
 * An item as the command palette holds it: everything a card knows, plus the
 * first `SEARCH_PREVIEW_LENGTH` characters of its body.
 *
 * A superset of `DashboardItem` on purpose — selecting a result opens the item
 * drawer, which takes exactly that, so a palette row can be handed straight to
 * `openItem` with nothing missing from the header while the detail request is
 * in flight.
 */
export interface SearchItem extends DashboardItem {
  /**
   * The item's body, truncated in SQL. Null for an item that stores no text —
   * file and image items, and a link, which keeps its URL instead.
   */
  contentPreview: string | null;
}
