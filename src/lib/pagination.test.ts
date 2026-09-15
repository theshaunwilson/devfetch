/**
 * The page-number arithmetic behind `/items/[type]`, `/collections/[id]` and
 * `/collections`.
 *
 * Pure, so there is nothing to mock. What is worth pinning is the decisions
 * rather than the arithmetic: that a bad `?page=` clamps instead of 404ing or
 * throwing, that the first and last page stay reachable from any page, and that
 * the control never renders an ellipsis in place of a single page it could have
 * linked instead.
 */
import { describe, expect, it } from 'vitest';

import { buildPagination, getPageNumbers, pageSkip, parsePageParam } from './pagination';

describe('parsePageParam', () => {
  it('reads a page number out of the param', () => {
    expect(parsePageParam('3')).toBe(3);
  });

  it('is page 1 when the param is absent', () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it.each([
    ['zero', '0'],
    ['a negative', '-2'],
    ['a non-number', 'abc'],
    ['a number with a tail', '2abc'],
    ['a decimal', '1.5'],
    ['an empty string', ''],
    ['whitespace', ' 2 '],
  ])('is page 1 for %s', (_label, raw) => {
    // Deliberately strict: `2abc` is a malformed param, not page 2. Everything
    // that is not plainly a page number lands on the first page rather than
    // being guessed at.
    expect(parsePageParam(raw)).toBe(1);
  });

  it('takes the first of a repeated param', () => {
    // `?page=2&page=5` arrives as an array.
    expect(parsePageParam(['2', '5'])).toBe(2);
  });
});

describe('buildPagination', () => {
  it('reports one page for an empty list', () => {
    // An empty list still has a first page; it just holds nothing. Zero pages
    // would leave the caller dividing by it.
    expect(buildPagination({ total: 0, perPage: 21, requestedPage: 1 })).toMatchObject({
      page: 1,
      totalPages: 1,
      total: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it('counts a partly-filled last page as a page', () => {
    expect(buildPagination({ total: 22, perPage: 21, requestedPage: 1 }).totalPages).toBe(2);
  });

  it('does not add an empty page when the last one is exactly full', () => {
    expect(buildPagination({ total: 42, perPage: 21, requestedPage: 1 }).totalPages).toBe(2);
  });

  it('clamps a page past the end to the last page', () => {
    // The case that decides this is ordinary: you are on the last page, you
    // delete the items on it, and the page you are standing on stops existing.
    expect(buildPagination({ total: 22, perPage: 21, requestedPage: 99 })).toMatchObject({
      page: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('clamps a page below the first to page 1', () => {
    expect(buildPagination({ total: 22, perPage: 21, requestedPage: 0 }).page).toBe(1);
  });

  it('offers a next page but no previous one on the first of several', () => {
    expect(buildPagination({ total: 100, perPage: 21, requestedPage: 1 })).toMatchObject({
      page: 1,
      totalPages: 5,
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });

  it('offers both directions in the middle', () => {
    expect(buildPagination({ total: 100, perPage: 21, requestedPage: 3 })).toMatchObject({
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('carries the total through, which is what a count line reads', () => {
    // Not the page's own length: that is what the count lines showed before
    // these lists were paged.
    expect(buildPagination({ total: 97, perPage: 21, requestedPage: 2 }).total).toBe(97);
  });
});

describe('pageSkip', () => {
  it('skips nothing for the first page', () => {
    expect(pageSkip(1, 21)).toBe(0);
  });

  it('skips every earlier page', () => {
    expect(pageSkip(3, 21)).toBe(42);
  });
});

describe('getPageNumbers', () => {
  it('lists every page while they all fit', () => {
    expect(getPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('never renders an ellipsis while every page is listed', () => {
    for (let page = 1; page <= 7; page++) {
      expect(getPageNumbers(page, 7)).not.toContain('ellipsis');
    }
  });

  it('keeps the first and the last page reachable from anywhere', () => {
    for (let page = 1; page <= 40; page++) {
      const links = getPageNumbers(page, 40);

      expect(links[0]).toBe(1);
      expect(links.at(-1)).toBe(40);
      expect(links).toContain(page);
    }
  });

  it('holds a constant width whichever page is current', () => {
    // So the control does not grow and shrink under the cursor as you move
    // through it.
    for (let page = 1; page <= 40; page++) {
      expect(getPageNumbers(page, 40)).toHaveLength(7);
    }
  });

  it('collapses the run after a window near the start', () => {
    expect(getPageNumbers(2, 40)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 40]);
  });

  it('collapses the run before a window near the end', () => {
    expect(getPageNumbers(39, 40)).toEqual([1, 'ellipsis', 36, 37, 38, 39, 40]);
  });

  it('collapses both runs around a window in the middle', () => {
    expect(getPageNumbers(20, 40)).toEqual([1, 'ellipsis', 19, 20, 21, 'ellipsis', 40]);
  });

  it('renders a single skipped page rather than an ellipsis standing for it', () => {
    // Same cell either way, and one of them is a link.
    expect(getPageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10]);
    expect(getPageNumbers(7, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
  });

  it('widens the window when asked for more neighbours', () => {
    expect(getPageNumbers(20, 40, 2)).toEqual([1, 'ellipsis', 18, 19, 20, 21, 22, 'ellipsis', 40]);
  });
});
