/**
 * `createCollection` is the write behind a public server action, so the two
 * properties worth pinning are that the owner comes from the session rather
 * than the payload, and that the unique index rejecting a duplicate name comes
 * back as an outcome the form can render rather than as a thrown error.
 *
 * Same pattern as `src/lib/db/items.test.ts`: mock `@/lib/prisma` and
 * `@/lib/db/user`, leave everything else real, so no database is involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    collection: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    item: { groupBy: vi.fn() },
    itemCollection: { findMany: vi.fn() },
    itemType: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db/user', () => ({ getCurrentUserId: vi.fn() }));

const { prisma } = await import('@/lib/prisma');
const { getCurrentUserId } = await import('@/lib/db/user');
const {
  createCollection,
  deleteCollection,
  getAllCollections,
  getCollectionOptions,
  getOwnedCollectionIds,
  getRecentCollections,
  updateCollection,
} = await import('./collections');
const { Prisma } = await import('@/generated/prisma/client');

const currentUser = vi.mocked(getCurrentUserId);

/** What the `select` narrows a `Collection` row down to. */
interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
}

// Typed through the select's own shape: `vi.mocked` resolves Prisma's
// overloaded signature to the full model and would reject a selected row —
// which `tsc` catches and the green suite does not.
const create = prisma.collection.create as unknown as Mock<
  (args: unknown) => Promise<CollectionRow>
>;
const update = prisma.collection.update as unknown as Mock<
  (args: unknown) => Promise<{ id: string }>
>;
const remove = prisma.collection.delete as unknown as Mock<
  (args: unknown) => Promise<{ id: string }>
>;
const findCollections = prisma.collection.findMany as unknown as Mock<
  // `_count` is optional here because the other callers of `collection.findMany`
  // in this file do not select it; `getCollectionOptions` is the one that does.
  (args: unknown) => Promise<{ id: string; name: string; _count?: { items: number } }[]>
>;
const findFilings = prisma.itemCollection.findMany as unknown as Mock<
  (args: unknown) => Promise<{ collectionId: string; item: { typeId: string } }[]>
>;
const countCollections = prisma.collection.count as unknown as Mock<
  (args: unknown) => Promise<number>
>;
const findTypes = prisma.itemType.findMany as unknown as Mock<
  (args: unknown) => Promise<
    { id: string; name: string; icon: string | null; color: string | null }[]
  >
>;

const USER_ID = 'user_1';

const row: CollectionRow = {
  id: 'collection_1',
  name: 'React Patterns',
  description: null,
  isFavorite: false,
};

/** Prisma's own error shape, so the `instanceof` narrowing is exercised. */
function notFound() {
  return new Prisma.PrismaClientKnownRequestError('No record was found', {
    code: 'P2025',
    clientVersion: '7.0.0',
  });
}

/** Prisma's own error shape, so the `instanceof` narrowing is exercised. */
function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.0.0',
    meta: { target: ['userId', 'name'] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(USER_ID);
});

describe('createCollection', () => {
  it('connects the row to the signed-in user', async () => {
    create.mockResolvedValue(row);

    await createCollection({ name: 'React Patterns', description: null });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user: { connect: { id: USER_ID } } }),
      }),
    );
  });

  it('returns nothing and never writes when there is no session', async () => {
    currentUser.mockResolvedValue(null);

    const outcome = await createCollection({ name: 'React Patterns', description: null });

    expect(outcome).toEqual({ ok: false, reason: 'no-session' });
    expect(create).not.toHaveBeenCalled();
  });

  it('stores an omitted description as null', async () => {
    create.mockResolvedValue(row);

    await createCollection({ name: 'React Patterns' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: null }) }),
    );
  });

  it('never writes a color, which nothing reads', async () => {
    // The dashboard and sidebar take their accent from the collection's
    // most-used item *type*, so `Collection.color` is deliberately left unset
    // rather than given a picker nothing would honour.
    create.mockResolvedValue(row);

    await createCollection({ name: 'React Patterns', description: null });

    const [args] = create.mock.calls[0] as [{ data: Record<string, unknown> }];

    expect(args.data).not.toHaveProperty('color');
  });

  it('reports a brand-new collection as empty without an aggregation query', async () => {
    create.mockResolvedValue(row);

    const outcome = await createCollection({ name: 'React Patterns', description: null });

    expect(outcome).toEqual({
      ok: true,
      collection: { ...row, itemCount: 0, types: [], accentColor: null },
    });
    // Nothing can be in it yet, so the type-usage groupBy is not worth running.
    expect(prisma.item.groupBy).not.toHaveBeenCalled();
  });

  it('turns a unique-index violation into a duplicate-name outcome', async () => {
    create.mockRejectedValue(uniqueViolation());

    const outcome = await createCollection({ name: 'React Patterns', description: null });

    expect(outcome).toEqual({ ok: false, reason: 'duplicate-name' });
  });

  it('rethrows any other database error rather than reporting a duplicate', async () => {
    // A connection failure reported as "that name is taken" would send the user
    // off renaming a collection that would have saved fine.
    create.mockRejectedValue(new Error('connection lost'));

    await expect(createCollection({ name: 'React Patterns' })).rejects.toThrow('connection lost');
  });
});

/**
 * The picker in both item forms is populated from this, and the ids it hands
 * back are resolved through `getOwnedCollectionIds` before anything is written
 * — which is the check that stops an item being filed into somebody else's
 * collection.
 */
describe('getCollectionOptions', () => {
  it('returns only the signed-in user’s own collections', async () => {
    findCollections.mockResolvedValue([
      { id: 'coll_1', name: 'React Patterns', _count: { items: 3 } },
    ]);

    await expect(getCollectionOptions()).resolves.toEqual([
      { id: 'coll_1', name: 'React Patterns', itemCount: 3 },
    ]);
    expect(findCollections).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });

  /** The palette shows the count beside the name; the item forms' picker ignores it. */
  it('reports how many items are filed in each, counted on the join', async () => {
    findCollections.mockResolvedValue([
      { id: 'coll_1', name: 'React Patterns', _count: { items: 4 } },
      { id: 'coll_2', name: 'Empty', _count: { items: 0 } },
    ]);

    await expect(getCollectionOptions()).resolves.toEqual([
      { id: 'coll_1', name: 'React Patterns', itemCount: 4 },
      { id: 'coll_2', name: 'Empty', itemCount: 0 },
    ]);
    expect(findCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, _count: { select: { items: true } } },
      }),
    );
  });

  it('orders them by name, since this is a list to find a known one in', async () => {
    findCollections.mockResolvedValue([]);

    await getCollectionOptions();

    expect(findCollections).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('returns nothing without querying when nobody is signed in', async () => {
    currentUser.mockResolvedValue(null);

    await expect(getCollectionOptions()).resolves.toEqual([]);
    expect(findCollections).not.toHaveBeenCalled();
  });
});

describe('getOwnedCollectionIds', () => {
  it('scopes the lookup to the signed-in user, not the ids alone', async () => {
    findCollections.mockResolvedValue([{ id: 'coll_1', name: 'React Patterns' }]);

    await getOwnedCollectionIds(['coll_1', 'someone_elses']);

    expect(findCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, id: { in: ['coll_1', 'someone_elses'] } },
      }),
    );
  });

  it('returns only the ids that came back, so a caller can spot a missing one', async () => {
    findCollections.mockResolvedValue([{ id: 'coll_1', name: 'React Patterns' }]);

    await expect(getOwnedCollectionIds(['coll_1', 'someone_elses'])).resolves.toEqual(['coll_1']);
  });

  it('asks nothing when handed nothing', async () => {
    await expect(getOwnedCollectionIds([])).resolves.toEqual([]);
    expect(findCollections).not.toHaveBeenCalled();
  });

  it('returns nothing without querying when nobody is signed in', async () => {
    currentUser.mockResolvedValue(null);

    await expect(getOwnedCollectionIds(['coll_1'])).resolves.toEqual([]);
    expect(findCollections).not.toHaveBeenCalled();
  });
});

/**
 * The per-collection counts and type mix behind the dashboard grid and the
 * sidebar. Items became a many-to-many relation, so the aggregation that was a
 * database `groupBy` is now done here in JS — which is exactly why it is worth
 * a test rather than trusted to Postgres.
 */
describe('getRecentCollections', () => {
  const TYPES = [
    { id: 'type_1', name: 'snippet', icon: 'Code', color: '#3b82f6' },
    { id: 'type_2', name: 'note', icon: 'StickyNote', color: '#fde047' },
    { id: 'type_3', name: 'command', icon: 'Terminal', color: '#f97316' },
  ];

  beforeEach(() => {
    findCollections.mockResolvedValue([{ id: 'coll_1', name: 'React Patterns' }]);
    findTypes.mockResolvedValue(TYPES);
  });

  it('counts the filings per collection rather than reading item rows', async () => {
    findFilings.mockResolvedValue([
      { collectionId: 'coll_1', item: { typeId: 'type_1' } },
      { collectionId: 'coll_1', item: { typeId: 'type_1' } },
      { collectionId: 'coll_1', item: { typeId: 'type_2' } },
    ]);

    const [collection] = await getRecentCollections(6);

    expect(collection.itemCount).toBe(3);
    // Most used type first: two snippets beat one note.
    expect(collection.types.map((type) => type.name)).toEqual(['snippet', 'note']);
    // And the border colour follows the most used type.
    expect(collection.accentColor).toBe('#3b82f6');
  });

  it('breaks a tie alphabetically, so the icon order does not wander', async () => {
    findFilings.mockResolvedValue([
      { collectionId: 'coll_1', item: { typeId: 'type_1' } },
      { collectionId: 'coll_1', item: { typeId: 'type_3' } },
    ]);

    const [collection] = await getRecentCollections(6);

    expect(collection.types.map((type) => type.name)).toEqual(['command', 'snippet']);
  });

  it('asserts ownership through the item, which is where userId lives', async () => {
    findFilings.mockResolvedValue([]);

    await getRecentCollections(6);

    expect(findFilings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectionId: { in: ['coll_1'] }, item: { userId: USER_ID } },
      }),
    );
  });

  it('reports an empty collection as empty, without looking up any type', async () => {
    findFilings.mockResolvedValue([]);

    const [collection] = await getRecentCollections(6);

    expect(collection).toMatchObject({ itemCount: 0, types: [], accentColor: null });
    expect(findTypes).not.toHaveBeenCalled();
  });

  it('skips the aggregation entirely when the user has no collections', async () => {
    findCollections.mockResolvedValue([]);

    await expect(getRecentCollections(6)).resolves.toEqual([]);
    expect(findFilings).not.toHaveBeenCalled();
  });
});

/**
 * The `/collections` index. It was deliberately unbounded until it was paged,
 * on the grounds that a ceiling would hide a user's own collections — so what
 * is worth pinning is that the ceiling is a page rather than a cut: the total
 * is reported in full, and a page past the end lands on the last one.
 */
describe('getAllCollections', () => {
  beforeEach(() => {
    findCollections.mockResolvedValue([{ id: 'coll_1', name: 'React Patterns' }]);
    findFilings.mockResolvedValue([]);
    countCollections.mockResolvedValue(0);
  });

  it('scopes both the count and the page to the signed-in user', async () => {
    await getAllCollections(1);

    expect(countCollections.mock.calls[0][0]).toMatchObject({ where: { userId: USER_ID } });
    expect(findCollections.mock.calls[0][0]).toMatchObject({ where: { userId: USER_ID } });
  });

  it('fetches one page rather than every collection the user owns', async () => {
    countCollections.mockResolvedValue(60);

    await getAllCollections(1);

    expect(findCollections.mock.calls[0][0]).toMatchObject({ skip: 0, take: 21 });
  });

  it('skips the earlier pages to reach the one asked for', async () => {
    countCollections.mockResolvedValue(60);

    await getAllCollections(3);

    expect(findCollections.mock.calls[0][0]).toMatchObject({ skip: 42, take: 21 });
  });

  it('clamps a page past the end to the last one', async () => {
    countCollections.mockResolvedValue(22);

    const { pagination } = await getAllCollections(99);

    expect(findCollections.mock.calls[0][0]).toMatchObject({ skip: 21 });
    expect(pagination).toMatchObject({ page: 2, totalPages: 2, hasNextPage: false });
  });

  it('reports the total across every page, which is what the count line reads', async () => {
    countCollections.mockResolvedValue(60);

    const { collections, pagination } = await getAllCollections(1);

    expect(pagination.total).toBe(60);
    expect(collections).toHaveLength(1);
  });

  it('keeps favorites at the top of the first page', async () => {
    await getAllCollections(1);

    // Postgres sorts false before true, so `desc` on the boolean is what puts
    // favorites first — and paging must not reorder them into the middle.
    expect(findCollections.mock.calls[0][0]).toMatchObject({
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    });
  });

  it('aggregates only the page, not the whole index', async () => {
    countCollections.mockResolvedValue(60);

    await getAllCollections(1);

    // The type usage is derived from the ids the page returned, so a user with
    // a thousand collections does not pull a thousand collections' join rows.
    expect(findFilings.mock.calls[0][0]).toMatchObject({
      where: { collectionId: { in: ['coll_1'] }, item: { userId: USER_ID } },
    });
  });

  it('returns an empty first page without querying when nobody is signed in', async () => {
    currentUser.mockResolvedValue(null);

    const { collections, pagination } = await getAllCollections(1);

    expect(collections).toEqual([]);
    expect(pagination).toMatchObject({ page: 1, totalPages: 1, total: 0 });
    expect(countCollections).not.toHaveBeenCalled();
    expect(findCollections).not.toHaveBeenCalled();
  });
});

describe('updateCollection', () => {
  beforeEach(() => {
    update.mockResolvedValue({ id: 'collection_1' });
  });

  it('scopes the update to the signed-in user, in the where clause itself', async () => {
    // The id arrives from the client. A read to check ownership followed by a
    // write leaves a window between the two, so the filter rides along with the
    // update — without it, one user could rename another's collection.
    await updateCollection('collection_1', { name: 'React Patterns', description: null });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'collection_1', userId: USER_ID } }),
    );
  });

  it('never writes without a session', async () => {
    currentUser.mockResolvedValue(null);

    const outcome = await updateCollection('collection_1', {
      name: 'React Patterns',
      description: null,
    });

    expect(outcome).toEqual({ ok: false, reason: 'no-session' });
    expect(update).not.toHaveBeenCalled();
  });

  it('writes both fields the user can change', async () => {
    await updateCollection('collection_1', { name: 'Renamed', description: 'Hooks' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Renamed', description: 'Hooks' } }),
    );
  });

  it('clears a blanked description rather than leaving the old text behind', async () => {
    // The schema turns a blank field into null, and null is what empties the
    // column — an update that skipped it would keep showing the old text.
    await updateCollection('collection_1', { name: 'React Patterns', description: null });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: null }) }),
    );
  });

  it('never writes a color, which nothing reads', async () => {
    await updateCollection('collection_1', { name: 'React Patterns', description: null });

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];

    expect(args.data).not.toHaveProperty('color');
  });

  it('turns a unique-index violation into a duplicate-name outcome', async () => {
    // A rename can collide with an existing name, and a pre-check cannot close
    // the race — so the index decides and the form renders the field error.
    update.mockRejectedValue(uniqueViolation());

    const outcome = await updateCollection('collection_1', {
      name: 'React Patterns',
      description: null,
    });

    expect(outcome).toEqual({ ok: false, reason: 'duplicate-name' });
  });

  it('turns nothing matching into a not-found outcome', async () => {
    // Somebody else's collection and one that never existed both land here.
    update.mockRejectedValue(notFound());

    const outcome = await updateCollection('collection_1', {
      name: 'React Patterns',
      description: null,
    });

    expect(outcome).toEqual({ ok: false, reason: 'not-found' });
  });

  it('rethrows anything that is not one of those two', async () => {
    update.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateCollection('collection_1', { name: 'React Patterns', description: null }),
    ).rejects.toThrow('connection lost');
  });
});

describe('deleteCollection', () => {
  beforeEach(() => {
    remove.mockResolvedValue({ id: 'collection_1' });
  });

  it('scopes the delete to the signed-in user, in the where clause itself', async () => {
    await deleteCollection('collection_1');

    expect(remove).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'collection_1', userId: USER_ID } }),
    );
  });

  it('never deletes without a session', async () => {
    currentUser.mockResolvedValue(null);

    await expect(deleteCollection('collection_1')).resolves.toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the collection and nothing else', async () => {
    // The items it held survive: `ItemCollection.collection` is `onDelete:
    // Cascade`, so the filings go and the item rows are untouched. Nothing here
    // may write an Item, and no transaction is needed to make that true.
    await deleteCollection('collection_1');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(prisma.item.groupBy).not.toHaveBeenCalled();
  });

  it('reports nothing matching as not deleted rather than throwing', async () => {
    remove.mockRejectedValue(notFound());

    await expect(deleteCollection('collection_1')).resolves.toBe(false);
  });

  it('rethrows anything that is not a missing row', async () => {
    remove.mockRejectedValue(new Error('connection lost'));

    await expect(deleteCollection('collection_1')).rejects.toThrow('connection lost');
  });
});
