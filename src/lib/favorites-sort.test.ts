import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FAVORITE_SORT,
  FAVORITE_SORT_OPTIONS,
  sortFavoriteCollections,
  sortFavoriteItems,
  type FavoriteSort,
} from './favorites-sort';

/** The four fields the item comparison reads, and nothing else. */
function item(id: string, title: string, updatedAt: string, typeName: string) {
  return { id, title, updatedAt, type: { name: typeName } };
}

function collection(id: string, name: string, updatedAt: string) {
  return { id, name, updatedAt };
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

const by = (key: FavoriteSort['key'], direction: FavoriteSort['direction']): FavoriteSort => ({
  key,
  direction,
});

describe('FAVORITE_SORT_OPTIONS', () => {
  it('offers exactly the three keys the control names', () => {
    expect(FAVORITE_SORT_OPTIONS.map((option) => option.id)).toEqual(['date', 'name', 'type']);
  });

  it('opens on date, newest first — the order the queries already return', () => {
    // The default has to be the status quo, or the page would reorder itself
    // the moment the control was added.
    expect(DEFAULT_FAVORITE_SORT).toEqual({ key: 'date', direction: 'desc' });
    expect(FAVORITE_SORT_OPTIONS.some((option) => option.id === DEFAULT_FAVORITE_SORT.key)).toBe(
      true,
    );
  });
});

describe('sortFavoriteItems', () => {
  const rows = [
    item('c', 'Banana', '2026-01-02T00:00:00.000Z', 'snippet'),
    item('a', 'apple', '2026-03-01T00:00:00.000Z', 'command'),
    item('b', 'Cherry', '2026-02-01T00:00:00.000Z', 'prompt'),
  ];

  it('sorts by name, ascending and descending', () => {
    expect(ids(sortFavoriteItems(rows, by('name', 'asc')))).toEqual(['a', 'c', 'b']);
    expect(ids(sortFavoriteItems(rows, by('name', 'desc')))).toEqual(['b', 'c', 'a']);
  });

  it('sorts by name without putting every capital ahead of every lowercase', () => {
    // A plain `<` would sort "Zebra" before "apple", because every uppercase
    // code point is below every lowercase one.
    const cased = [item('z', 'Zebra', '2026-01-01T00:00:00.000Z', 'note'), rows[1]];
    expect(ids(sortFavoriteItems(cased, by('name', 'asc')))).toEqual(['a', 'z']);
  });

  it('sorts numbered titles by their number rather than their digits', () => {
    const numbered = [
      item('ten', 'Step 10', '2026-01-01T00:00:00.000Z', 'note'),
      item('two', 'Step 2', '2026-01-01T00:00:00.000Z', 'note'),
    ];
    expect(ids(sortFavoriteItems(numbered, by('name', 'asc')))).toEqual(['two', 'ten']);
  });

  it('sorts by date, newest first when descending', () => {
    expect(ids(sortFavoriteItems(rows, by('date', 'desc')))).toEqual(['a', 'b', 'c']);
    expect(ids(sortFavoriteItems(rows, by('date', 'asc')))).toEqual(['c', 'b', 'a']);
  });

  it('sorts by item type name', () => {
    expect(ids(sortFavoriteItems(rows, by('type', 'asc')))).toEqual(['a', 'b', 'c']);
    expect(ids(sortFavoriteItems(rows, by('type', 'desc')))).toEqual(['c', 'b', 'a']);
  });

  it('breaks a tie on the chosen key by name', () => {
    // Three favorited items really do share an identical `updatedAt`, so
    // without this their order is whatever the database happened to return.
    // The ids deliberately run opposite to the names: sorted by id these come
    // back z, y, x, so only the name tie-break can produce the order below.
    const sameDate = [
      item('x', 'Charlie', '2026-01-01T00:00:00.000Z', 'note'),
      item('z', 'Alpha', '2026-01-01T00:00:00.000Z', 'note'),
      item('y', 'Bravo', '2026-01-01T00:00:00.000Z', 'note'),
    ];
    expect(ids(sortFavoriteItems(sameDate, by('date', 'asc')))).toEqual(['z', 'y', 'x']);
  });

  it('breaks a tie on name and date by id, so the order is total', () => {
    // Two items can carry the same title on the same day; a cuid cannot tie.
    const identical = [
      item('b2', 'Setup', '2026-01-01T00:00:00.000Z', 'note'),
      item('a1', 'Setup', '2026-01-01T00:00:00.000Z', 'note'),
    ];
    expect(ids(sortFavoriteItems(identical, by('name', 'asc')))).toEqual(['a1', 'b2']);
  });

  it('reverses the tie-breaks along with the key, so no part sorts the other way', () => {
    // Ids again run opposite to the names, so a fallback to the id order would
    // give the other answer in both directions.
    const sameType = [
      item('b', 'Alpha', '2026-01-01T00:00:00.000Z', 'note'),
      item('a', 'Bravo', '2026-01-01T00:00:00.000Z', 'note'),
    ];
    expect(ids(sortFavoriteItems(sameType, by('type', 'asc')))).toEqual(['b', 'a']);
    expect(ids(sortFavoriteItems(sameType, by('type', 'desc')))).toEqual(['a', 'b']);
  });

  it('returns a new array rather than sorting the caller in place', () => {
    const original = [...rows];
    const sorted = sortFavoriteItems(rows, by('name', 'asc'));
    expect(sorted).not.toBe(rows);
    expect(rows).toEqual(original);
  });

  it('handles an empty list and a single row', () => {
    expect(sortFavoriteItems([], by('name', 'asc'))).toEqual([]);
    expect(ids(sortFavoriteItems([rows[0]], by('type', 'desc')))).toEqual(['c']);
  });
});

describe('sortFavoriteCollections', () => {
  // Ids run opposite to the names (x3 < y2 < z1 while Terminal > React > AI),
  // so a test expecting name order cannot be satisfied by the id tie-break.
  const rows = [
    collection('x3', 'Terminal Commands', '2026-01-02T00:00:00.000Z'),
    collection('z1', 'AI Workflows', '2026-03-01T00:00:00.000Z'),
    collection('y2', 'React Patterns', '2026-02-01T00:00:00.000Z'),
  ];

  it('sorts by name and by date', () => {
    expect(ids(sortFavoriteCollections(rows, by('name', 'asc')))).toEqual(['z1', 'y2', 'x3']);
    expect(ids(sortFavoriteCollections(rows, by('date', 'desc')))).toEqual(['z1', 'y2', 'x3']);
    expect(ids(sortFavoriteCollections(rows, by('date', 'asc')))).toEqual(['x3', 'y2', 'z1']);
  });

  it('falls back to name order under the type key, having no type of its own', () => {
    // Every collection compares equal on type, so the shared name tie-break is
    // what decides — the behaviour comes out of the comparison chain rather
    // than a branch that could drift from it.
    expect(ids(sortFavoriteCollections(rows, by('type', 'asc')))).toEqual(['z1', 'y2', 'x3']);
    expect(ids(sortFavoriteCollections(rows, by('type', 'desc')))).toEqual(['x3', 'y2', 'z1']);
  });

  it('orders collections under the type key exactly as the name key does', () => {
    const byType = ids(sortFavoriteCollections(rows, by('type', 'asc')));
    const byName = ids(sortFavoriteCollections(rows, by('name', 'asc')));
    expect(byType).toEqual(byName);
  });

  it('returns a new array rather than sorting the caller in place', () => {
    const original = [...rows];
    const sorted = sortFavoriteCollections(rows, by('date', 'asc'));
    expect(sorted).not.toBe(rows);
    expect(rows).toEqual(original);
  });
});
