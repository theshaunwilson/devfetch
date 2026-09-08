/**
 * The item-type queries, moved out of `items.ts` with their tests.
 *
 * The property worth pinning is the global-types join: the seven built-in
 * types are `userId: null`, so a plain `userId` filter would return none of
 * them, while dropping the `userId` half would expose another user's custom
 * types. `visibleItemTypeFilter` is now the single place that rule lives.
 *
 * Same pattern as the other db tests: mock `@/lib/prisma` and `@/lib/db/user`
 * at the module boundary, leave everything else real, touch no database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    item: { groupBy: vi.fn() },
    itemType: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db/user', () => ({ getCurrentUserId: vi.fn() }));

const { prisma } = await import('@/lib/prisma');
const { getCurrentUserId } = await import('@/lib/db/user');
const { getItemTypeById, getItemTypes, visibleItemTypeFilter } = await import('./item-types');

const findType = prisma.itemType.findFirst as unknown as Mock<
  (args: unknown) => Promise<{ id: string; slug: string } | null>
>;
const currentUserId = vi.mocked(getCurrentUserId);

/** What `getItemTypes` selects from `ItemType`, and what it counts. */
interface TypeRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

const findManyTypes = prisma.itemType.findMany as unknown as Mock<
  (args: unknown) => Promise<TypeRow[]>
>;
const groupByType = prisma.item.groupBy as unknown as Mock<
  (args: unknown) => Promise<{ typeId: string; _count: { _all: number } }[]>
>;

const USER_ID = 'user_1';

beforeEach(() => {
  vi.clearAllMocks();
  currentUserId.mockResolvedValue(USER_ID);
});

describe('visibleItemTypeFilter', () => {
  it('matches the global system types as well as the user their own', () => {
    // The seven built-ins are userId: null, so a plain { userId } filter would
    // return none of them.
    expect(visibleItemTypeFilter(USER_ID)).toEqual({
      OR: [{ userId: null }, { userId: USER_ID }],
    });
  });

  it('names the user, so another user their custom types stay invisible', () => {
    expect(visibleItemTypeFilter('user_2').OR).toContainEqual({ userId: 'user_2' });
    expect(visibleItemTypeFilter('user_2').OR).not.toContainEqual({ userId: USER_ID });
  });
});

describe('getItemTypeById', () => {
  it("accepts a global system type or one of the user's own, and nothing else", async () => {
    findType.mockResolvedValue({ id: 'type_1', slug: 'snippet' });

    await getItemTypeById('type_1');

    expect(findType.mock.calls[0][0]).toMatchObject({
      where: { id: 'type_1', OR: [{ userId: null }, { userId: USER_ID }] },
    });
  });

  it('returns null when the id names a type the user cannot see', async () => {
    findType.mockResolvedValue(null);

    await expect(getItemTypeById('someone_elses_type')).resolves.toBeNull();
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(getItemTypeById('type_1')).resolves.toBeNull();
    expect(findType).not.toHaveBeenCalled();
  });
});

describe('getItemTypes', () => {
  const SYSTEM_TYPE: TypeRow = {
    id: 'type_snippet',
    name: 'snippet',
    slug: 'snippet',
    icon: 'Code',
    color: '#3b82f6',
  };
  const CUSTOM_TYPE: TypeRow = {
    id: 'type_recipe',
    name: 'recipe',
    slug: 'recipe',
    icon: null,
    color: null,
  };

  beforeEach(() => {
    findManyTypes.mockResolvedValue([SYSTEM_TYPE]);
    groupByType.mockResolvedValue([]);
  });

  it('asks for the global system types as well as the user\'s own', async () => {
    await getItemTypes();

    expect(findManyTypes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: null }, { userId: USER_ID }] },
      }),
    );
  });

  it('orders by creation, so the built-ins keep their seeded order', async () => {
    await getItemTypes();

    expect(findManyTypes).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });

  it('counts only the signed-in user\'s items, though the types are shared', async () => {
    await getItemTypes();

    expect(groupByType).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['typeId'], where: { userId: USER_ID } }),
    );
  });

  it('attaches each type its own count', async () => {
    findManyTypes.mockResolvedValue([SYSTEM_TYPE, CUSTOM_TYPE]);
    groupByType.mockResolvedValue([
      { typeId: 'type_recipe', _count: { _all: 2 } },
      { typeId: 'type_snippet', _count: { _all: 4 } },
    ]);

    expect(await getItemTypes()).toEqual([
      { ...SYSTEM_TYPE, itemCount: 4 },
      { ...CUSTOM_TYPE, itemCount: 2 },
    ]);
  });

  // An unused type has no groupBy row at all, so the count has to come from
  // somewhere — the sidebar shows 0 for File and Image, not a blank.
  it('reports zero for a type no item uses, rather than dropping it', async () => {
    findManyTypes.mockResolvedValue([SYSTEM_TYPE, CUSTOM_TYPE]);
    groupByType.mockResolvedValue([{ typeId: 'type_snippet', _count: { _all: 4 } }]);

    const types = await getItemTypes();

    expect(types).toHaveLength(2);
    expect(types[1]).toEqual({ ...CUSTOM_TYPE, itemCount: 0 });
  });

  it('returns nothing without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    expect(await getItemTypes()).toEqual([]);
    expect(findManyTypes).not.toHaveBeenCalled();
    expect(groupByType).not.toHaveBeenCalled();
  });
});

