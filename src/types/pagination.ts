/** A page number, or a run of pages a control collapses into an ellipsis. */
export type PageLink = number | 'ellipsis';

/** Where a paged list is, and what a pagination control needs to draw itself. */
export interface Pagination {
  /** 1-based, and always a page that exists. */
  page: number;
  /** At least 1: an empty list still has a first page, it just holds nothing. */
  totalPages: number;
  /** Rows across every page, which is what a list's count line reads. */
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
