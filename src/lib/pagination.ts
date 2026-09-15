/**
 * Page-number arithmetic for the paged lists.
 *
 * Pure on purpose, and so unit tested: the queries in `src/lib/db/` decide what
 * to fetch from what `buildPagination` works out, and `PaginationControls`
 * renders exactly the links `getPageNumbers` names. Neither the request nor
 * Prisma appears here.
 */

import type { PageLink, Pagination } from '@/types/pagination';

/**
 * The page a `?page=` search param asks for, before the list's real length is
 * known.
 *
 * Deliberately strict: only digits parse, so `2abc` is a malformed param rather
 * than page 2. Anything else — absent, malformed, zero, negative, repeated —
 * is page 1, which `buildPagination` then clamps against the pages that exist.
 * Repeated params arrive as an array; the first wins.
 */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1;

  return Math.max(Number.parseInt(value, 10), 1);
}

interface BuildPaginationInput {
  /** Rows the list holds in total, from a `count` alongside the page query. */
  total: number;
  perPage: number;
  /** What the URL asked for, from `parsePageParam`. */
  requestedPage: number;
}

/**
 * Resolves a requested page against the list's real length.
 *
 * Out of range clamps rather than 404s, both ends. The case that decides it is
 * an ordinary one: you are on the last page, you delete the items on it, and
 * the page you are standing on stops existing — landing on the new last page
 * is the answer a user wants there, and a 404 is not.
 */
export function buildPagination({ total, perPage, requestedPage }: BuildPaginationInput): Pagination {
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);

  return {
    page,
    totalPages,
    total,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

/** Rows to skip to reach the start of a page. */
export function pageSkip(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

/**
 * The page numbers a control renders, with ellipses standing in for the runs it
 * leaves out.
 *
 * The first and last page are always reachable, and the current page always
 * sits between `siblings` neighbours. Past that the list is a fixed width —
 * `siblings * 2 + 5` cells — whichever page is current, so the control does not
 * grow and shrink as you move through it. An ellipsis covering exactly one page
 * is rendered as that page instead: it costs the same cell and saves a click.
 */
export function getPageNumbers(page: number, totalPages: number, siblings = 1): PageLink[] {
  const slots = siblings * 2 + 5;

  if (totalPages <= slots) return range(1, totalPages);

  // A window against either end is widened to hold the width, since the missing
  // ellipsis on that side frees a cell.
  const endBlock = slots - 2;

  if (page - siblings <= 2) {
    return [...range(1, endBlock), 'ellipsis', totalPages];
  }

  if (page + siblings >= totalPages - 1) {
    return [1, 'ellipsis', ...range(totalPages - endBlock + 1, totalPages)];
  }

  const start = page - siblings;
  const end = page + siblings;

  return [
    1,
    ...gap(2, start - 1),
    ...range(start, end),
    ...gap(end + 1, totalPages - 1),
    totalPages,
  ];
}

/** A run of pages as a single cell: the page itself when there is only one. */
function gap(from: number, to: number): PageLink[] {
  if (from > to) return [];

  return from === to ? [from] : ['ellipsis'];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
