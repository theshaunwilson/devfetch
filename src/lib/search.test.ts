/**
 * The palette's pure half. What a row is matched on, and whether a keydown is
 * the shortcut at all — both decisions the component makes but neither of
 * which needs a DOM to check.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  buildCollectionKeywords,
  buildItemKeywords,
  collapseWhitespace,
  isSearchShortcut,
  scoreKeywords,
  SEARCH_ITEM_LIMIT,
  SEARCH_PREVIEW_LENGTH,
  SEARCH_SCORE_THRESHOLD,
} from './search';
import type { DashboardItem } from '@/types/item';

const item = (overrides: Partial<DashboardItem & { contentPreview: string | null }> = {}) => ({
  id: 'item_1',
  title: 'useDebounce Hook',
  description: 'Delays a rapidly changing value until it settles',
  isFavorite: false,
  isPinned: false,
  updatedAt: '2026-08-18T21:56:33.193Z',
  createdAt: '2026-08-17T10:00:00.000Z',
  fileUrl: null,
  fileName: null,
  fileSize: null,
  type: { id: 'type_1', name: 'snippet', slug: 'snippet', icon: 'Code', color: '#3b82f6' },
  tags: ['hooks', 'react'],
  contentPreview: 'export function useDebounce() {}',
  ...overrides,
});

describe('isSearchShortcut', () => {
  const event = (overrides: Partial<Parameters<typeof isSearchShortcut>[0]> = {}) => ({
    key: 'k',
    metaKey: true,
    ctrlKey: false,
    defaultPrevented: false,
    ...overrides,
  });

  it('accepts Cmd+K', () => {
    expect(isSearchShortcut(event())).toBe(true);
  });

  it('accepts Ctrl+K, which is the same shortcut on Windows', () => {
    expect(isSearchShortcut(event({ metaKey: false, ctrlKey: true }))).toBe(true);
  });

  it('accepts it with caps lock on', () => {
    expect(isSearchShortcut(event({ key: 'K' }))).toBe(true);
  });

  it('refuses a bare k, which is a character somebody is typing', () => {
    expect(isSearchShortcut(event({ metaKey: false }))).toBe(false);
  });

  it('refuses another modified key', () => {
    expect(isSearchShortcut(event({ key: 'p' }))).toBe(false);
  });

  /**
   * The listener sits on the document, so it sees keys another handler has
   * already claimed. Monaco binds Cmd+K chords of its own, and the drawer and
   * the create dialog both render it.
   */
  it('refuses a key an editor has already handled', () => {
    expect(isSearchShortcut(event({ defaultPrevented: true }))).toBe(false);
  });
});

describe('collapseWhitespace', () => {
  it('flattens a multi-line body into one line', () => {
    expect(collapseWhitespace('const a = 1;\n\n  const b = 2;')).toBe('const a = 1; const b = 2;');
  });

  it('trims the ends, so a leading indent does not become a leading space', () => {
    expect(collapseWhitespace('   indented\t')).toBe('indented');
  });
});

describe('buildItemKeywords', () => {
  it('matches on the title', () => {
    expect(buildItemKeywords(item())).toContain('useDebounce Hook');
  });

  it('matches on the type name, so “snippet” finds every snippet', () => {
    expect(buildItemKeywords(item())).toContain('snippet');
  });

  it('matches on every tag', () => {
    const keywords = buildItemKeywords(item());

    expect(keywords).toContain('hooks');
    expect(keywords).toContain('react');
  });

  it('matches on the body preview, which is the point of searching a snippet hub', () => {
    expect(buildItemKeywords(item())).toContain('export function useDebounce() {}');
  });

  it('flattens a multi-line preview, so the query is matched against one line', () => {
    const keywords = buildItemKeywords(item({ contentPreview: 'line one\n  line two' }));

    expect(keywords).toContain('line one line two');
  });

  it('matches on the uploaded filename, which a file item has instead of a body', () => {
    const keywords = buildItemKeywords(
      item({ contentPreview: null, description: null, fileName: 'quarterly-report.pdf' }),
    );

    expect(keywords).toContain('quarterly-report.pdf');
  });

  /** An empty keyword would score against every query and rank noise. */
  it('drops the fields an item does not have', () => {
    const keywords = buildItemKeywords(
      item({ description: null, contentPreview: null, fileName: null, tags: [] }),
    );

    expect(keywords).toEqual(['useDebounce Hook', 'snippet']);
  });

  it('drops a field that is only whitespace', () => {
    const keywords = buildItemKeywords(item({ description: '   ' }));

    expect(keywords).not.toContain('   ');
    expect(keywords.every((keyword) => keyword.trim().length > 0)).toBe(true);
  });

  /**
   * cmdk identifies a row by its `value`, which has to be unique and is
   * therefore the id. A cuid in the searched text matches short queries by
   * accident, which is the whole reason the keywords exist.
   */
  it('never carries the id, which is what the row is identified by', () => {
    expect(buildItemKeywords(item()).join(' ')).not.toContain('item_1');
  });
});

describe('buildCollectionKeywords', () => {
  it('matches on the name', () => {
    expect(buildCollectionKeywords({ id: 'coll_1', name: 'React Patterns', itemCount: 4 })).toEqual([
      'React Patterns',
    ]);
  });

  it('never carries the id', () => {
    const keywords = buildCollectionKeywords({ id: 'coll_1', name: 'React Patterns', itemCount: 4 });

    expect(keywords.join(' ')).not.toContain('coll_1');
  });

  it('drops a name that is only whitespace rather than matching everything', () => {
    expect(buildCollectionKeywords({ id: 'coll_1', name: '  ', itemCount: 0 })).toEqual([]);
  });
});

describe('the ceilings', () => {
  it('truncates the body well short of what the column holds', () => {
    // CONTENT_MAX_LENGTH is 100,000, and the whole index ships in the shell's
    // payload on every request.
    expect(SEARCH_PREVIEW_LENGTH).toBeLessThan(1_000);
  });

  it('leaves a Pro account room past the Free tier’s 50 items', () => {
    expect(SEARCH_ITEM_LIMIT).toBeGreaterThan(50);
  });
});

/**
 * The fix for a palette that matched almost everything. cmdk's `command-score`
 * matches a query as a subsequence, so "test" scored above zero on 21 of the
 * 22 seeded items. The scorer is injected, so these pin the decisions — best
 * field wins, weak matches are dropped — rather than command-score's internals.
 */
describe('scoreKeywords', () => {
  /** Scores a keyword by how much of it the query is, as a crude stand-in. */
  const scorer = (value: string, search: string) =>
    value.toLowerCase().includes(search.toLowerCase()) ? search.length / value.length : 0;

  it('takes the best field rather than the sum, so many weak fields cannot add up', () => {
    const score = scoreKeywords(['test', 'a longer field holding test', 'test'], 'test', scorer);

    // 1.0 from the exact field, not 1 + 0.15 + 1.
    expect(score).toBe(1);
  });

  /**
   * The joined-string version let a query take a letter from the title, one
   * from a tag and the rest from the body. Scoring per field is what stops it.
   */
  it('never scores across two fields joined together', () => {
    const spy = vi.fn(() => 1);

    scoreKeywords(['alpha', 'beta'], 'alphabeta', spy);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('alpha', 'alphabeta');
    expect(spy).toHaveBeenCalledWith('beta', 'alphabeta');
    expect(spy).not.toHaveBeenCalledWith('alpha beta', 'alphabeta');
  });

  it('drops a match below the threshold, which cmdk reads as “do not show it”', () => {
    const weak = () => SEARCH_SCORE_THRESHOLD - 0.01;

    expect(scoreKeywords(['whatever'], 'test', weak)).toBe(0);
  });

  it('keeps a match exactly at the threshold', () => {
    const exact = () => SEARCH_SCORE_THRESHOLD;

    expect(scoreKeywords(['whatever'], 'test', exact)).toBe(SEARCH_SCORE_THRESHOLD);
  });

  it('keeps the real score of a match it accepts, so cmdk can still rank', () => {
    expect(scoreKeywords(['testing'], 'test', scorer)).toBeCloseTo(4 / 7);
  });

  it('scores a row with no keywords at zero rather than matching everything', () => {
    expect(scoreKeywords([], 'test', scorer)).toBe(0);
  });

  /**
   * The band between a real match and scattered noise was measured at roughly
   * 0.17 to 0.79 on the seeded data. A cut outside it would either let the
   * noise back in or start dropping genuine matches.
   */
  it('cuts inside the empty band the measurements found', () => {
    expect(SEARCH_SCORE_THRESHOLD).toBeGreaterThan(0.17);
    expect(SEARCH_SCORE_THRESHOLD).toBeLessThan(0.79);
  });
});
