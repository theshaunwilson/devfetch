/**
 * `getItemDetail` backs `GET /api/items/[id]`, so the id it is handed comes
 * from the request. The ownership filter is what stops that id reading another
 * user's item, which is the property worth pinning here.
 *
 * The first test for `src/lib/db/*`. Same pattern as `src/actions/auth.test.ts`:
 * mock the module boundary — `@/lib/prisma` and `@/lib/db/user` — and leave
 * everything else real, so no database is involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { item: { findFirst: vi.fn(), update: vi.fn() } },
}));

vi.mock('@/lib/db/user', () => ({ getCurrentUserId: vi.fn() }));

const { prisma } = await import('@/lib/prisma');
const { getCurrentUserId } = await import('@/lib/db/user');
const { getItemDetail, updateItem } = await import('./items');
const { Prisma } = await import('@/generated/prisma/client');

/** What `ITEM_DETAIL_SELECT` narrows an `Item` row down to. */
interface DetailRow {
  id: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  updatedAt: Date;
  createdAt: Date;
  type: { id: string; name: string; slug: string; icon: string | null; color: string | null };
  tags: { tag: { name: string } }[];
  content: string | null;
  language: string | null;
  url: string | null;
  collection: { id: string; name: string } | null;
}

// Prisma's `findFirst` is overloaded on its `select`, so `vi.mocked` resolves
// it to the full-model signature and rejects a selected row. Addressing the
// mock through the shape the query actually returns is what keeps this typed
// rather than reaching for `any`.
const findFirst = prisma.item.findFirst as unknown as Mock<
  (args: unknown) => Promise<DetailRow | null>
>;
const update = prisma.item.update as unknown as Mock<(args: unknown) => Promise<DetailRow>>;
const currentUserId = vi.mocked(getCurrentUserId);

const USER_ID = 'user_1';
const ITEM_ID = 'item_1';

const row = (overrides: Partial<DetailRow> = {}): DetailRow => ({
  id: ITEM_ID,
  title: 'useDebounce Hook',
  description: 'Delays a rapidly changing value until it settles',
  isFavorite: true,
  isPinned: true,
  updatedAt: new Date('2026-08-18T21:56:33.193Z'),
  createdAt: new Date('2026-08-17T10:00:00.000Z'),
  type: { id: 'type_1', name: 'snippet', slug: 'snippet', icon: 'Code', color: '#3b82f6' },
  tags: [{ tag: { name: 'hooks' } }, { tag: { name: 'react' } }],
  content: 'export function useDebounce() {}',
  language: 'typescript',
  url: null,
  collection: { id: 'coll_1', name: 'React Patterns' },
  ...overrides,
});

/** The one argument shape `prisma.item.update` is called with. */
interface UpdateArgs {
  where: { id: string; userId: string };
  data: Record<string, unknown> & {
    tags?: { deleteMany: object; create: { tag: { connectOrCreate: { where: object } } }[] };
  };
}

const updateArgs = (): UpdateArgs => update.mock.calls[0][0] as UpdateArgs;

beforeEach(() => {
  vi.clearAllMocks();
  currentUserId.mockResolvedValue(USER_ID);
});

describe('getItemDetail', () => {
  it('scopes the lookup to the signed-in user, not the id alone', async () => {
    findFirst.mockResolvedValue(row());

    await getItemDetail(ITEM_ID);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0]).toMatchObject({ where: { id: ITEM_ID, userId: USER_ID } });
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(getItemDetail(ITEM_ID)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns null when the id names no item the user owns', async () => {
    findFirst.mockResolvedValue(null);

    await expect(getItemDetail(ITEM_ID)).resolves.toBeNull();
  });

  it('serializes both dates to ISO strings, since the drawer is a client component', async () => {
    findFirst.mockResolvedValue(row());

    const item = await getItemDetail(ITEM_ID);

    expect(item).toMatchObject({
      updatedAt: '2026-08-18T21:56:33.193Z',
      createdAt: '2026-08-17T10:00:00.000Z',
    });
  });

  it('flattens the join rows to tag names', async () => {
    findFirst.mockResolvedValue(row());

    await expect(getItemDetail(ITEM_ID)).resolves.toMatchObject({ tags: ['hooks', 'react'] });
  });

  it('carries the detail-only fields through', async () => {
    findFirst.mockResolvedValue(row());

    await expect(getItemDetail(ITEM_ID)).resolves.toMatchObject({
      content: 'export function useDebounce() {}',
      language: 'typescript',
      collection: { id: 'coll_1', name: 'React Patterns' },
    });
  });

  it('keeps the nullable fields null rather than dropping them', async () => {
    // A Link item: no content, no language, and not filed in a collection.
    findFirst.mockResolvedValue(row({ content: null, language: null, collection: null }));

    const item = await getItemDetail(ITEM_ID);

    expect(item).toMatchObject({ content: null, language: null, collection: null });
    // The drawer omits a section on null, so the keys must be present to read.
    expect(item).toHaveProperty('collection', null);
  });
});

describe('updateItem', () => {
  beforeEach(() => {
    update.mockResolvedValue(row());
  });

  it('scopes the write itself to the signed-in user, not just the id', async () => {
    await updateItem(ITEM_ID, { title: 'New title' });

    // The ownership filter is inside the update rather than a read before it:
    // a read-then-write could be raced, and the id comes from the client.
    expect(updateArgs().where).toEqual({ id: ITEM_ID, userId: USER_ID });
  });

  it('returns null without writing when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(updateItem(ITEM_ID, { title: 'New title' })).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('returns null when the row does not match, rather than throwing', async () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    // An unknown id and somebody else's id both land here, and the caller
    // cannot tell them apart.
    await expect(updateItem(ITEM_ID, { title: 'New title' })).resolves.toBeNull();
  });

  it('rethrows anything that is not a missing row', async () => {
    update.mockRejectedValue(new Error('connection lost'));

    await expect(updateItem(ITEM_ID, { title: 'New title' })).rejects.toThrow('connection lost');
  });

  it('writes only the fields it was given, so an unshown one is left alone', async () => {
    await updateItem(ITEM_ID, { title: 'New title', description: null });

    const { data } = updateArgs();

    expect(data.title).toBe('New title');
    // Present and null: the description was cleared on purpose.
    expect(data).toHaveProperty('description', null);
    // Absent entirely: a link item never showed a content box, and sending
    // undefined here would be the difference between keeping and wiping it.
    expect(data).not.toHaveProperty('content');
    expect(data).not.toHaveProperty('url');
    expect(data).not.toHaveProperty('language');
  });

  it('leaves the tags untouched when none were sent', async () => {
    await updateItem(ITEM_ID, { title: 'New title' });

    expect(updateArgs().data).not.toHaveProperty('tags');
  });

  it('replaces the whole tag set, connecting or creating each name', async () => {
    await updateItem(ITEM_ID, { title: 'New title', tags: ['react', 'hooks'] });

    const { tags } = updateArgs().data;

    // Every join row goes first, so the new set is exactly what was sent.
    expect(tags?.deleteMany).toEqual({});
    expect(tags?.create).toHaveLength(2);
    expect(tags?.create.map((row) => row.tag.connectOrCreate.where)).toEqual([
      { userId_name: { userId: USER_ID, name: 'react' } },
      { userId_name: { userId: USER_ID, name: 'hooks' } },
    ]);
  });

  it('clears every tag when handed an empty array', async () => {
    await updateItem(ITEM_ID, { title: 'New title', tags: [] });

    expect(updateArgs().data.tags).toEqual({ deleteMany: {}, create: [] });
  });

  it('returns the saved item in the drawer\'s own shape, so no second fetch is needed', async () => {
    const saved = await updateItem(ITEM_ID, { title: 'New title' });

    expect(saved).toMatchObject({
      id: ITEM_ID,
      tags: ['hooks', 'react'],
      type: { slug: 'snippet' },
      updatedAt: '2026-08-18T21:56:33.193Z',
      createdAt: '2026-08-17T10:00:00.000Z',
    });
  });
});
