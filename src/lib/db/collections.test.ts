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
    collection: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    item: { groupBy: vi.fn() },
    itemType: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db/user', () => ({ getCurrentUserId: vi.fn() }));

const { prisma } = await import('@/lib/prisma');
const { getCurrentUserId } = await import('@/lib/db/user');
const { createCollection } = await import('./collections');
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

const USER_ID = 'user_1';

const row: CollectionRow = {
  id: 'collection_1',
  name: 'React Patterns',
  description: null,
  isFavorite: false,
};

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
