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
    },
    itemType: { findFirst: vi.fn(), findMany: vi.fn() },
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
  getItemsByTypeSlug,
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
const destroy = prisma.item.delete as unknown as Mock<
  (args: unknown) => Promise<{ fileUrl: string | null }>
>;
const create = prisma.item.create as unknown as Mock<(args: unknown) => Promise<DetailRow>>;
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

  const imageType = { id: 'type_img', name: 'image', icon: 'Image', color: '#ec4899' };

  beforeEach(() => {
    lookupType.mockResolvedValue(imageType);
    findMany.mockResolvedValue([]);
  });

  it('accepts a global system type as well as one of the user\'s own', async () => {
    await getItemsByTypeSlug('image');

    // The seven built-ins are userId: null, so a plain userId filter would
    // match none of them.
    expect(lookupType.mock.calls[0][0]).toMatchObject({
      where: { slug: 'image', OR: [{ userId: null }, { userId: USER_ID }] },
    });
  });

  it('scopes the items to the signed-in user and the resolved type', async () => {
    await getItemsByTypeSlug('image');

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID, typeId: imageType.id },
    });
  });

  it('selects the file columns, without which no thumbnail could ever resolve', async () => {
    await getItemsByTypeSlug('image');

    expect(findMany.mock.calls[0][0]).toMatchObject({
      select: { fileUrl: true, fileName: true },
    });
  });

  it('carries the file columns onto a card, so a gallery can find the thumbnail', async () => {
    findMany.mockResolvedValue([
      row({ fileUrl: `users/${USER_ID}/abc-123.png`, fileName: 'diagram.png' }),
    ]);

    const result = await getItemsByTypeSlug('image');

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

    const result = await getItemsByTypeSlug('file');

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

    const result = await getItemsByTypeSlug('image');

    // Null rather than absent: the card branches on it, and an undefined that
    // typechecked would draw a placeholder for every item.
    expect(result?.items[0].fileUrl).toBeNull();
    expect(result?.items[0].fileName).toBeNull();
    expect(result?.items[0].fileSize).toBeNull();
  });

  it('selects the type slug, without which no card could decide what to copy', async () => {
    await getItemsByTypeSlug('snippet');

    expect(findMany.mock.calls[0][0]).toMatchObject({
      select: { type: { select: { slug: true } } },
    });
  });

  it('carries the type slug onto a card, so its copy button knows its field', async () => {
    findMany.mockResolvedValue([row()]);

    const result = await getItemsByTypeSlug('snippet');

    // The name is user-facing text and a custom type may reuse a system slug,
    // so the slug is the only stable thing a card can branch on.
    expect(result?.items[0].type.slug).toBe('snippet');
  });

  it('returns null when the slug names no type the user can see', async () => {
    lookupType.mockResolvedValue(null);

    // A typo is a 404, which reads differently from a type holding nothing.
    expect(await getItemsByTypeSlug('nonsense')).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns null without querying when nobody is signed in', async () => {
    currentUserId.mockResolvedValue(null);

    expect(await getItemsByTypeSlug('image')).toBeNull();
    expect(lookupType).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
