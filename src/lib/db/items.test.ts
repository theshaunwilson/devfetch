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
  prisma: {
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    itemType: { findFirst: vi.fn(), findMany: vi.fn() },
    collection: { findFirst: vi.fn() },
    itemCollection: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/user', () => ({ getCurrentUserId: vi.fn() }));

const { prisma } = await import('@/lib/prisma');
const { getCurrentUserId } = await import('@/lib/db/user');
const {
  createItem,
  deleteItem,
  getItemDetail,
  getItemFile,
  getItemsByCollectionId,
  getFavoriteItems,
  getItemsByTypeSlug,
  getSearchItems,
  setItemFavorite,
  updateItem,
} = await import('./items');
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
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  collections: { collection: { id: string; name: string } }[];
}

// Prisma's `findFirst` is overloaded on its `select`, so `vi.mocked` resolves
// it to the full-model signature and rejects a selected row. Addressing the
// mock through the shape the query actually returns is what keeps this typed
// rather than reaching for `any`.
const findFirst = prisma.item.findFirst as unknown as Mock<
  (args: unknown) => Promise<DetailRow | null>
>;
const update = prisma.item.update as unknown as Mock<(args: unknown) => Promise<DetailRow>>;
const destroy = prisma.item.delete as unknown as Mock<
  (args: unknown) => Promise<{ fileUrl: string | null }>
>;
const create = prisma.item.create as unknown as Mock<(args: unknown) => Promise<DetailRow>>;
const executeRaw = prisma.$executeRaw as unknown as Mock<
  (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>
>;
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
  fileUrl: null,
  fileName: null,
  fileSize: null,
  collections: [{ collection: { id: 'coll_1', name: 'React Patterns' } }],
  ...overrides,
});

/** The one argument shape `prisma.item.update` is called with. */
interface UpdateArgs {
  where: { id: string; userId: string };
  data: Record<string, unknown> & {
    tags?: { deleteMany: object; create: { tag: { connectOrCreate: { where: object } } }[] };
    collections?: { deleteMany: object; create: { collection: { connect: { id: string } } }[] };
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
      collections: [{ id: 'coll_1', name: 'React Patterns' }],
    });
  });

  it('flattens every collection join row, not only the first', async () => {
    findFirst.mockResolvedValue(
      row({
        collections: [
          { collection: { id: 'coll_1', name: 'React Patterns' } },
          { collection: { id: 'coll_2', name: 'Context Files' } },
        ],
      }),
    );

    await expect(getItemDetail(ITEM_ID)).resolves.toMatchObject({
      collections: [
        { id: 'coll_1', name: 'React Patterns' },
        { id: 'coll_2', name: 'Context Files' },
      ],
    });
  });

  it('keeps the nullable fields null rather than dropping them', async () => {
    // A Link item: no content, no language, and filed in no collection at all.
    findFirst.mockResolvedValue(row({ content: null, language: null, collections: [] }));

    const item = await getItemDetail(ITEM_ID);

    expect(item).toMatchObject({ content: null, language: null });
    // The drawer omits a section on an empty list, so the key must be present
    // and an array — never undefined — to read.
    expect(item).toHaveProperty('collections', []);
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

  it('leaves the filings untouched when no collections were sent', async () => {
    await updateItem(ITEM_ID, { title: 'New title' });

    // The difference between "the form did not show this" and "in none".
    expect(updateArgs().data).not.toHaveProperty('collections');
  });

  it('replaces the whole set of filings, connecting each collection by id', async () => {
    await updateItem(ITEM_ID, { title: 'New title', collectionIds: ['coll_1', 'coll_2'] });

    const { collections } = updateArgs().data;

    expect(collections?.deleteMany).toEqual({});
    expect(collections?.create).toEqual([
      { collection: { connect: { id: 'coll_1' } } },
      { collection: { connect: { id: 'coll_2' } } },
    ]);
  });

  it('unfiles the item from everything when handed an empty array', async () => {
    await updateItem(ITEM_ID, { title: 'New title', collectionIds: [] });

    expect(updateArgs().data.collections).toEqual({ deleteMany: {}, create: [] });
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

describe('deleteItem', () => {
  beforeEach(() => {
    destroy.mockResolvedValue({ fileUrl: null });
  });

  it('scopes the delete itself to the signed-in user, not just the id', async () => {
    await deleteItem(ITEM_ID);

    // The same reason `updateItem` does it: the id comes from the client, and
    // a read-then-delete would leave a window between the check and the write.
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls[0][0]).toMatchObject({ where: { id: ITEM_ID, userId: USER_ID } });
  });

  it('reports success when the row was removed', async () => {
    await expect(deleteItem(ITEM_ID)).resolves.toEqual({ deleted: true, fileKey: null });
  });

  it('returns false without deleting anything when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(deleteItem(ITEM_ID)).resolves.toEqual({ deleted: false, fileKey: null });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('returns false when the row does not match, rather than throwing', async () => {
    destroy.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    // An unknown id and somebody else's id are the same answer.
    await expect(deleteItem(ITEM_ID)).resolves.toEqual({ deleted: false, fileKey: null });
  });

  it('rethrows anything that is not a missing row', async () => {
    destroy.mockRejectedValue(new Error('connection lost'));

    await expect(deleteItem(ITEM_ID)).rejects.toThrow('connection lost');
  });
});

/** The one argument shape `prisma.item.create` is called with. */
interface CreateArgs {
  data: Record<string, unknown> & {
    user: { connect: { id: string } };
    type: { connect: { id: string } };
    tags: { create: { tag: { connectOrCreate: { where: object; create: object } } }[] };
    collections: { create: { collection: { connect: { id: string } } }[] };
  };
}

const createArgs = (): CreateArgs => create.mock.calls[0][0] as CreateArgs;

describe('createItem', () => {
  const data = {
    typeId: 'type_1',
    title: 'useDebounce Hook',
    description: 'Delays a value',
    content: 'export function useDebounce() {}',
    language: 'typescript',
    url: null,
    tags: ['hooks', 'react'],
  };

  it('takes the owner from the session, never from the caller', async () => {
    create.mockResolvedValue(row());

    // A `userId` in the payload would be the whole attack: it must not reach
    // the write.
    await createItem({ ...data, userId: 'someone_else' } as never, 'text');

    expect(createArgs().data.user).toEqual({ connect: { id: USER_ID } });
    expect(createArgs().data).not.toHaveProperty('userId');
  });

  it('files the item under the type it was given', async () => {
    create.mockResolvedValue(row());

    await createItem(data, 'text');

    expect(createArgs().data.type).toEqual({ connect: { id: 'type_1' } });
  });

  it('returns null without writing when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(createItem(data, 'text')).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('writes a field the form never showed as null rather than leaving it out', async () => {
    create.mockResolvedValue(row());

    // A link item sends no content or language at all. On a create there is
    // nothing behind those columns to preserve, so both mean empty.
    await createItem({ typeId: 'type_1', title: 'A link', url: 'https://example.com' }, 'text');

    expect(createArgs().data).toMatchObject({
      description: null,
      content: null,
      language: null,
      url: 'https://example.com',
    });
  });

  it('connects an existing tag rather than creating a second one for the same user', async () => {
    create.mockResolvedValue(row());

    await createItem(data, 'text');

    const tags = createArgs().data.tags.create;

    expect(tags).toHaveLength(2);
    expect(tags[0].tag.connectOrCreate).toEqual({
      where: { userId_name: { userId: USER_ID, name: 'hooks' } },
      create: { userId: USER_ID, name: 'hooks' },
    });
  });

  it('writes no tag rows when none were sent', async () => {
    create.mockResolvedValue(row());

    await createItem({ typeId: 'type_1', title: 'Untagged' }, 'text');

    expect(createArgs().data.tags.create).toEqual([]);
  });

  it('files the item in every collection it was given, by id', async () => {
    create.mockResolvedValue(row());

    await createItem({ ...data, collectionIds: ['coll_1', 'coll_2'] }, 'text');

    // Connected, never created: a collection has to exist to be filed into.
    expect(createArgs().data.collections.create).toEqual([
      { collection: { connect: { id: 'coll_1' } } },
      { collection: { connect: { id: 'coll_2' } } },
    ]);
  });

  it('writes no filings when no collections were sent', async () => {
    create.mockResolvedValue(row());

    await createItem({ typeId: 'type_1', title: 'Uncollected' }, 'text');

    expect(createArgs().data.collections.create).toEqual([]);
  });

  it('serializes both dates, so the dialog gets the same shape a card holds', async () => {
    create.mockResolvedValue(row());

    await expect(createItem(data, 'text')).resolves.toMatchObject({
      updatedAt: '2026-08-18T21:56:33.193Z',
      createdAt: '2026-08-17T10:00:00.000Z',
    });
  });
});

/**
 * `getItemTypes` feeds both the sidebar and the items page's create button.
 * The property worth pinning is the global-types join: the seven built-ins are
 * `userId: null`, so a plain `userId` filter would return none of them.
 */
describe('getItemFile', () => {
  /** What the download proxy's own narrower select returns. */
  interface FileRow {
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    type: { slug: string };
  }

  const fileRow = (overrides: Partial<FileRow> = {}): FileRow => ({
    fileUrl: `users/${USER_ID}/abc-123.pdf`,
    fileName: 'runbook.pdf',
    fileSize: 2048,
    type: { slug: 'file' },
    ...overrides,
  });

  const lookup = findFirst as unknown as Mock<(args: unknown) => Promise<FileRow | null>>;

  it('scopes the lookup to the signed-in user, which is what authorises the read', async () => {
    lookup.mockResolvedValue(fileRow());

    await getItemFile(ITEM_ID);

    // The object key is only ever reached through an item this user owns, so
    // this filter is the whole of the download proxy's access control.
    expect(findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: ITEM_ID, userId: USER_ID },
    });
  });

  it('returns the key, name and type slug the proxy needs', async () => {
    lookup.mockResolvedValue(fileRow());

    await expect(getItemFile(ITEM_ID)).resolves.toEqual({
      key: `users/${USER_ID}/abc-123.pdf`,
      fileName: 'runbook.pdf',
      fileSize: 2048,
      typeSlug: 'file',
    });
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(getItemFile(ITEM_ID)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns null for an item that has no file', async () => {
    // A snippet is a perfectly real item of this user's, and still not
    // something the proxy can serve.
    lookup.mockResolvedValue(fileRow({ fileUrl: null }));

    await expect(getItemFile(ITEM_ID)).resolves.toBeNull();
  });

  it('returns null for a row with a key but no name to serve it under', async () => {
    lookup.mockResolvedValue(fileRow({ fileName: null }));

    await expect(getItemFile(ITEM_ID)).resolves.toBeNull();
  });

  it('returns null when nothing matched, so another user’s id reads as absent', async () => {
    lookup.mockResolvedValue(null);

    await expect(getItemFile(ITEM_ID)).resolves.toBeNull();
  });
});

describe('createItem, with a file', () => {
  const data = {
    typeId: 'type_2',
    title: 'Deployment runbook',
    fileUrl: `users/${USER_ID}/abc-123.pdf`,
    fileName: 'runbook.pdf',
    fileSize: 2048,
  };

  it('writes the content type the caller decided, not one from the payload', async () => {
    create.mockResolvedValue(row());

    await createItem(data, 'file');

    expect(createArgs().data.contentType).toBe('file');
  });

  it('writes the three file columns together', async () => {
    create.mockResolvedValue(row());

    await createItem(data, 'file');

    expect(createArgs().data).toMatchObject({
      fileUrl: `users/${USER_ID}/abc-123.pdf`,
      fileName: 'runbook.pdf',
      fileSize: 2048,
    });
  });

  it('leaves the file columns null on a text item', async () => {
    create.mockResolvedValue(row());

    await createItem({ typeId: 'type_1', title: 'A note' }, 'text');

    expect(createArgs().data).toMatchObject({
      contentType: 'text',
      fileUrl: null,
      fileName: null,
      fileSize: null,
    });
  });
});

describe('deleteItem, with a file', () => {
  it('hands back the deleted row’s key, so the caller can remove the object', async () => {
    destroy.mockResolvedValue({ fileUrl: `users/${USER_ID}/abc-123.pdf` });

    // From the same statement that proved the item was this user's, so there
    // is no window in which the two could disagree.
    await expect(deleteItem(ITEM_ID)).resolves.toEqual({
      deleted: true,
      fileKey: `users/${USER_ID}/abc-123.pdf`,
    });
  });

  it('selects the key rather than reading the row first', async () => {
    destroy.mockResolvedValue({ fileUrl: null });

    await deleteItem(ITEM_ID);

    expect(destroy.mock.calls[0][0]).toMatchObject({ select: { fileUrl: true } });
    expect(findFirst).not.toHaveBeenCalled();
  });
});

/**
 * Backs `/items/[type]`, including the image gallery. The gallery decides
 * between a thumbnail and a placeholder from `fileUrl`, so a card row that
 * does not carry it renders an empty gallery with nothing failing anywhere —
 * which is what these pin down.
 */
describe('getItemsByTypeSlug', () => {
  const findMany = prisma.item.findMany as unknown as Mock<
    (args: unknown) => Promise<DetailRow[]>
  >;
  const lookupType = prisma.itemType.findFirst as unknown as Mock<
    (args: unknown) => Promise<{
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    } | null>
  >;

  const count = prisma.item.count as unknown as Mock<(args: unknown) => Promise<number>>;

  const imageType = { id: 'type_img', name: 'image', icon: 'Image', color: '#ec4899' };

  beforeEach(() => {
    lookupType.mockResolvedValue(imageType);
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it('accepts a global system type as well as one of the user\'s own', async () => {
    await getItemsByTypeSlug('image', 1);

    // The seven built-ins are userId: null, so a plain userId filter would
    // match none of them.
    expect(lookupType.mock.calls[0][0]).toMatchObject({
      where: { slug: 'image', OR: [{ userId: null }, { userId: USER_ID }] },
    });
  });

  it('scopes the items to the signed-in user and the resolved type', async () => {
    await getItemsByTypeSlug('image', 1);

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID, typeId: imageType.id },
    });
  });

  it('selects the file columns, without which no thumbnail could ever resolve', async () => {
    await getItemsByTypeSlug('image', 1);

    expect(findMany.mock.calls[0][0]).toMatchObject({
      select: { fileUrl: true, fileName: true },
    });
  });

  it('carries the file columns onto a card, so a gallery can find the thumbnail', async () => {
    findMany.mockResolvedValue([
      row({ fileUrl: `users/${USER_ID}/abc-123.png`, fileName: 'diagram.png' }),
    ]);

    const result = await getItemsByTypeSlug('image', 1);

    expect(result?.items[0]).toMatchObject({
      fileUrl: `users/${USER_ID}/abc-123.png`,
      fileName: 'diagram.png',
    });
  });

  it('carries the size and the upload date onto a card, which the file list shows', async () => {
    findMany.mockResolvedValue([
      row({
        fileUrl: `users/${USER_ID}/abc-123.pdf`,
        fileName: 'spec.pdf',
        fileSize: 1_048_576,
        createdAt: new Date('2026-08-17T10:00:00.000Z'),
      }),
    ]);

    const result = await getItemsByTypeSlug('file', 1);

    expect(result?.items[0]).toMatchObject({
      fileSize: 1_048_576,
      // Serialized in the db layer, like `updatedAt`, so nothing downstream
      // handles a Date. `createdAt` is the upload date: an item's file cannot
      // be replaced, while `updatedAt` moves on every title or tag edit.
      createdAt: '2026-08-17T10:00:00.000Z',
    });
    expect(result?.items[0].createdAt).not.toBe(result?.items[0].updatedAt);
  });

  it('keeps the file columns null on an item with no object', async () => {
    findMany.mockResolvedValue([row()]);

    const result = await getItemsByTypeSlug('image', 1);

    // Null rather than absent: the card branches on it, and an undefined that
    // typechecked would draw a placeholder for every item.
    expect(result?.items[0].fileUrl).toBeNull();
    expect(result?.items[0].fileName).toBeNull();
    expect(result?.items[0].fileSize).toBeNull();
  });

  it('selects the type slug, without which no card could decide what to copy', async () => {
    await getItemsByTypeSlug('snippet', 1);

    expect(findMany.mock.calls[0][0]).toMatchObject({
      select: { type: { select: { slug: true } } },
    });
  });

  it('carries the type slug onto a card, so its copy button knows its field', async () => {
    findMany.mockResolvedValue([row()]);

    const result = await getItemsByTypeSlug('snippet', 1);

    // The name is user-facing text and a custom type may reuse a system slug,
    // so the slug is the only stable thing a card can branch on.
    expect(result?.items[0].type.slug).toBe('snippet');
  });

  it('returns null when the slug names no type the user can see', async () => {
    lookupType.mockResolvedValue(null);

    // A typo is a 404, which reads differently from a type holding nothing.
    expect(await getItemsByTypeSlug('nonsense', 1)).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    expect(await getItemsByTypeSlug('image', 1)).toBeNull();
    expect(lookupType).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('fetches one page rather than every item of the type', async () => {
    count.mockResolvedValue(60);

    await getItemsByTypeSlug('snippet', 1);

    expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 21 });
  });

  it('skips the earlier pages to reach the one asked for', async () => {
    count.mockResolvedValue(60);

    await getItemsByTypeSlug('snippet', 3);

    expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 42, take: 21 });
  });

  it('clamps a page past the end rather than fetching past it', async () => {
    count.mockResolvedValue(22);

    const result = await getItemsByTypeSlug('snippet', 99);

    // Counted before the slice is fetched, which is what makes this possible:
    // `?page=99` never becomes a real query with a skip to match.
    expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 21 });
    expect(result?.pagination).toMatchObject({ page: 2, totalPages: 2, hasNextPage: false });
  });

  it('counts the same rows the page is cut from', async () => {
    count.mockResolvedValue(60);

    await getItemsByTypeSlug('snippet', 1);

    // A count over a wider set than the slice would page the user through
    // items they cannot see.
    expect(count.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID, typeId: imageType.id },
    });
  });

  it('reports the total across every page, which is what the count line reads', async () => {
    count.mockResolvedValue(60);
    findMany.mockResolvedValue([row()]);

    const result = await getItemsByTypeSlug('snippet', 1);

    expect(result?.pagination).toMatchObject({ total: 60, totalPages: 3 });
    expect(result?.items).toHaveLength(1);
  });
});

/**
 * Backs `/collections/[id]`. The id arrives from the URL, so ownership is
 * asserted on both sides of the join — the collection is the user's, and every
 * item that comes back through it is too.
 */
describe('getItemsByCollectionId', () => {
  const lookupCollection = prisma.collection.findFirst as unknown as Mock<
    (args: unknown) => Promise<{
      id: string;
      name: string;
      description: string | null;
      isFavorite: boolean;
    } | null>
  >;
  const filings = prisma.itemCollection.findMany as unknown as Mock<
    (args: unknown) => Promise<{ item: DetailRow }[]>
  >;
  const count = prisma.itemCollection.count as unknown as Mock<
    (args: unknown) => Promise<number>
  >;

  const collection = { id: 'coll_1', name: 'React Patterns', description: null, isFavorite: false };

  beforeEach(() => {
    lookupCollection.mockResolvedValue(collection);
    filings.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it('scopes the collection lookup to the signed-in user', async () => {
    await getItemsByCollectionId('coll_1', 1);

    // `findFirst` on { id, userId } rather than `findUnique` on the id alone:
    // the id comes from the URL.
    expect(lookupCollection.mock.calls[0][0]).toMatchObject({
      where: { id: 'coll_1', userId: USER_ID },
    });
  });

  it('scopes the items to the user as well as to the collection', async () => {
    await getItemsByCollectionId('coll_1', 1);

    expect(filings.mock.calls[0][0]).toMatchObject({
      where: { collectionId: 'coll_1', item: { userId: USER_ID } },
    });
  });

  it('fetches one page rather than every item filed in the collection', async () => {
    count.mockResolvedValue(60);

    await getItemsByCollectionId('coll_1', 2);

    expect(filings.mock.calls[0][0]).toMatchObject({ skip: 21, take: 21 });
  });

  it('counts the same join rows the page is cut from', async () => {
    await getItemsByCollectionId('coll_1', 1);

    expect(count.mock.calls[0][0]).toMatchObject({
      where: { collectionId: 'coll_1', item: { userId: USER_ID } },
    });
  });

  it('clamps a page past the end to the last one', async () => {
    count.mockResolvedValue(22);

    const result = await getItemsByCollectionId('coll_1', 99);

    expect(filings.mock.calls[0][0]).toMatchObject({ skip: 21 });
    expect(result?.pagination).toMatchObject({ page: 2, totalPages: 2 });
  });

  it('reports the total across every page rather than the page it returned', async () => {
    count.mockResolvedValue(60);
    filings.mockResolvedValue([{ item: row() }]);

    const result = await getItemsByCollectionId('coll_1', 1);

    expect(result?.pagination.total).toBe(60);
    expect(result?.items).toHaveLength(1);
  });

  it('returns null when the id names no collection of the user\'s', async () => {
    lookupCollection.mockResolvedValue(null);

    // Somebody else's id reads exactly like one that never existed.
    expect(await getItemsByCollectionId('coll_other', 1)).toBeNull();
    expect(filings).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    expect(await getItemsByCollectionId('coll_1', 1)).toBeNull();
    expect(lookupCollection).not.toHaveBeenCalled();
    expect(filings).not.toHaveBeenCalled();
  });
});

/**
 * The command palette's index. It is pre-fetched into the shell on every
 * request, so what it selects — and what it does not — is the property worth
 * pinning: the body is truncated in SQL rather than fetched in full.
 */
describe('getSearchItems', () => {
  const findMany = prisma.item.findMany as unknown as Mock<
    (args: unknown) => Promise<DetailRow[]>
  >;
  const queryRaw = prisma.$queryRaw as unknown as Mock<
    (strings: TemplateStringsArray, ...values: unknown[]) => Promise<
      { id: string; preview: string | null }[]
    >
  >;

  beforeEach(() => {
    findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
  });

  it('returns nothing, and queries nothing, without a session', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(getSearchItems(500)).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns only the signed-in user’s items, most recently updated first', async () => {
    await getSearchItems(500);

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('applies the ceiling it is given, so the payload cannot grow without bound', async () => {
    await getSearchItems(120);

    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 120 });
  });

  it('never selects the body itself, which can be 100,000 characters', async () => {
    await getSearchItems(500);

    const args = findMany.mock.calls[0][0] as { select: Record<string, unknown> };

    expect(args.select.content).toBeUndefined();
  });

  it('scopes the preview statement to the user as well, not to the ids alone', async () => {
    findMany.mockResolvedValue([row()]);

    await getSearchItems(500);

    // The raw statement carries its own ownership predicate rather than
    // trusting the ids handed to it.
    expect(queryRaw.mock.calls[0]).toContain(USER_ID);
  });

  it('merges each preview onto its own item', async () => {
    findMany.mockResolvedValue([
      row({ id: 'item_1', title: 'One' }),
      row({ id: 'item_2', title: 'Two' }),
    ]);
    queryRaw.mockResolvedValue([
      { id: 'item_2', preview: 'second body' },
      { id: 'item_1', preview: 'first body' },
    ]);

    const items = await getSearchItems(500);

    // By id, not by position: the preview statement has its own ordering.
    expect(items.map((item) => [item.id, item.contentPreview])).toEqual([
      ['item_1', 'first body'],
      ['item_2', 'second body'],
    ]);
  });

  it('leaves the preview null for an item that stores no text', async () => {
    findMany.mockResolvedValue([row({ id: 'item_1' })]);
    queryRaw.mockResolvedValue([]);

    const items = await getSearchItems(500);

    expect(items[0].contentPreview).toBeNull();
  });

  it('skips the preview statement entirely when there are no items', async () => {
    findMany.mockResolvedValue([]);

    await expect(getSearchItems(500)).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('carries everything a card holds, so a result can open the drawer as one', async () => {
    findMany.mockResolvedValue([row()]);

    const items = await getSearchItems(500);

    expect(items[0]).toMatchObject({
      id: ITEM_ID,
      title: 'useDebounce Hook',
      type: { slug: 'snippet' },
      tags: ['hooks', 'react'],
      updatedAt: '2026-08-18T21:56:33.193Z',
    });
  });
});

describe('getFavoriteItems', () => {
  const findMany = prisma.item.findMany as unknown as Mock<
    (args: unknown) => Promise<DetailRow[]>
  >;

  beforeEach(() => {
    findMany.mockResolvedValue([]);
  });

  it('returns only the signed-in user\'s favorited items', async () => {
    await getFavoriteItems();

    // Both halves matter: `isFavorite` is what the page is for, and `userId`
    // is the only thing standing between it and another account's rows.
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID, isFavorite: true },
    });
  });

  it('orders by most recently updated', async () => {
    await getFavoriteItems();

    expect(findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('does not cap the list', async () => {
    await getFavoriteItems();

    // Favoriting is a deliberate act, so the list stays short — and a ceiling
    // on the one page whose job is to show what you starred would hide rows
    // with nowhere to reach them.
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('take');
  });

  it('returns nothing and never queries without a session', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(getFavoriteItems()).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('carries the whole card, which is what opens the drawer', async () => {
    findMany.mockResolvedValue([row()]);

    const [item] = await getFavoriteItems();

    // `openItem` takes a `DashboardItem`, not an id, so a narrower row could
    // not open the drawer at all.
    expect(item).toMatchObject({
      id: ITEM_ID,
      title: 'useDebounce Hook',
      type: { slug: 'snippet', icon: 'Code', color: '#3b82f6' },
      tags: ['hooks', 'react'],
      updatedAt: '2026-08-18T21:56:33.193Z',
    });
  });
});

describe('setItemFavorite', () => {
  beforeEach(() => {
    executeRaw.mockResolvedValue(1);
  });

  /** The interpolated values of the tagged-template call, in order. */
  function values() {
    return executeRaw.mock.calls[0].slice(1);
  }

  /** The SQL text, with the parameter holes closed up. */
  function sql() {
    return (executeRaw.mock.calls[0][0] as unknown as string[]).join('?').replace(/\s+/g, ' ');
  }

  it('scopes the update to the signed-in user, in the WHERE clause itself', async () => {
    // The id comes from the client, so the ownership filter has to be part of
    // the write: a read-then-write could be raced, and the id alone would reach
    // another user's item.
    await setItemFavorite(ITEM_ID, true);

    expect(sql()).toContain('WHERE "id" = ? AND "userId" = ?');
    expect(values()).toEqual([true, ITEM_ID, USER_ID]);
  });

  it('writes the value it was given rather than reading the row first', async () => {
    await setItemFavorite(ITEM_ID, true);
    expect(values()[0]).toBe(true);

    executeRaw.mockClear();
    await setItemFavorite(ITEM_ID, false);
    expect(values()[0]).toBe(false);

    // One statement and no read: a toggle would need the current value, which
    // is the race this avoids.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('leaves updatedAt alone', async () => {
    // The whole reason this is raw SQL. `updatedAt` is `@updatedAt`, so any
    // Prisma write would stamp it and starring an item would jump it to the top
    // of every list sorted by that column.
    await setItemFavorite(ITEM_ID, true);

    expect(sql()).not.toContain('updatedAt');
    expect(update).not.toHaveBeenCalled();
  });

  it('writes nothing but the flag', async () => {
    await setItemFavorite(ITEM_ID, true);

    expect(sql()).toContain('SET "isFavorite" = ?');
    expect(sql()).toContain('UPDATE "Item"');
  });

  it('never writes without a session', async () => {
    currentUserId.mockResolvedValue(null);

    await expect(setItemFavorite(ITEM_ID, true)).resolves.toBe(false);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('reports no row matched as not written', async () => {
    // A raw UPDATE matching nothing is not an error, so the affected-row count
    // is what says so. An unknown id and somebody else's id both land here.
    executeRaw.mockResolvedValue(0);

    await expect(setItemFavorite(ITEM_ID, true)).resolves.toBe(false);
  });

  it('rethrows a database failure rather than reporting it as not found', async () => {
    executeRaw.mockRejectedValue(new Error('connection lost'));

    await expect(setItemFavorite(ITEM_ID, true)).rejects.toThrow('connection lost');
  });
});
