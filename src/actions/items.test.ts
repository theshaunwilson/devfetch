/**
 * A server action is a public endpoint: the item id arrives from the client and
 * the payload is whatever was posted. What is pinned here is the order those
 * are dealt with — session first, then the schema, then a write that is itself
 * scoped to the user — and that a failure says enough for the form to point at
 * the field responsible.
 *
 * Same pattern as `src/actions/auth.test.ts`: mock the module boundary, leave
 * the Zod schema real so the action is tested against the rules production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db/items', () => ({
  createItem: vi.fn(),
  getItemTypeById: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

const { auth } = await import('@/auth');
const {
  createItem: createItemRow,
  getItemTypeById,
  updateItem: updateItemRow,
  deleteItem: deleteItemRow,
} = await import('@/lib/db/items');
const { createItem, deleteItem, updateItem } = await import('./items');

const session = vi.mocked(auth);
const writeRow = vi.mocked(updateItemRow);
const deleteRow = vi.mocked(deleteItemRow);
const createRow = vi.mocked(createItemRow);
const findType = vi.mocked(getItemTypeById);

const USER_ID = 'user_1';
const ITEM_ID = 'item_1';

const saved = {
  id: ITEM_ID,
  title: 'useDebounce',
  description: null,
  isFavorite: false,
  isPinned: false,
  updatedAt: '2026-08-18T21:56:33.193Z',
  createdAt: '2026-08-17T10:00:00.000Z',
  type: { id: 'type_1', name: 'snippet', slug: 'snippet', icon: 'Code', color: '#3b82f6' },
  tags: [],
  content: null,
  language: null,
  url: null,
  collection: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // `auth()` is typed as NextAuth's overloaded handler, so the session shape is
  // asserted through unknown rather than reconstructed in full.
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
  writeRow.mockResolvedValue(saved);
  deleteRow.mockResolvedValue(true);
  createRow.mockResolvedValue(saved);
  findType.mockResolvedValue({ id: 'type_1', slug: 'snippet' });
});

describe('updateItem', () => {
  it('refuses before parsing anything when there is no session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await updateItem(ITEM_ID, { title: 'New title' });

    expect(result).toEqual({ success: false, error: 'Your session has expired. Sign in again.' });
    expect(writeRow).not.toHaveBeenCalled();
  });

  it('refuses a session with no user id on it', async () => {
    session.mockResolvedValue({ user: {} } as unknown as never);

    await expect(updateItem(ITEM_ID, { title: 'x' })).resolves.toMatchObject({ success: false });
    expect(writeRow).not.toHaveBeenCalled();
  });

  it('returns the saved item on success', async () => {
    await expect(updateItem(ITEM_ID, { title: 'useDebounce' })).resolves.toEqual({
      success: true,
      data: saved,
    });
  });

  it('hands the query the normalized payload, not what was posted', async () => {
    await updateItem(ITEM_ID, { title: '  useDebounce  ', description: '  ', tags: [' a ', 'a'] });

    expect(writeRow).toHaveBeenCalledWith(ITEM_ID, {
      title: 'useDebounce',
      // Blank became null, so the column is cleared rather than set to ''.
      description: null,
      tags: ['a'],
    });
  });

  it('never writes when the payload fails validation', async () => {
    const result = await updateItem(ITEM_ID, { title: '   ' });

    expect(result).toMatchObject({ success: false });
    expect(writeRow).not.toHaveBeenCalled();
  });

  it('reports a bad title against its own field', async () => {
    const result = await updateItem(ITEM_ID, { title: '' });

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { title: ['Title is required'] },
    });
  });

  it('reports a bad URL against its own field', async () => {
    const result = await updateItem(ITEM_ID, { title: 'x', url: 'not a url' });

    expect(result).toMatchObject({ fieldErrors: { url: ['Enter a valid URL'] } });
  });

  it('lands a nested tag error on the tags field rather than losing it', async () => {
    // Zod paths this at `tags.0`; what the form has to render it against is
    // `tags`, so the grouping is the thing under test.
    const result = await updateItem(ITEM_ID, { title: 'x', tags: ['a'.repeat(51)] });

    expect(result).toMatchObject({ success: false });
    expect(result).toHaveProperty('fieldErrors.tags');
  });

  it('always carries a message, even when every error is per-field', async () => {
    const result = await updateItem(ITEM_ID, { title: '' });

    // A caller that only renders one line still has something to render.
    expect(result).toMatchObject({ success: false, error: expect.any(String) });
  });

  it('reads a missing row as not found rather than as a failure', async () => {
    writeRow.mockResolvedValue(null);

    // Somebody else's item and an unknown id are the same answer.
    await expect(updateItem(ITEM_ID, { title: 'x' })).resolves.toEqual({
      success: false,
      error: 'That item could not be found.',
    });
  });

  it('turns a thrown query into a generic failure rather than leaking it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    writeRow.mockRejectedValue(new Error('connection to db-prod-01 refused'));

    const result = await updateItem(ITEM_ID, { title: 'x' });

    expect(result).toEqual({
      success: false,
      error: 'Could not save your changes. Please try again.',
    });
  });
});

describe('deleteItem', () => {
  it('refuses without touching the row when there is no session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({ success: false, error: 'Your session has expired. Sign in again.' });
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('refuses a session with no user id on it', async () => {
    session.mockResolvedValue({ user: {} } as unknown as never);

    await expect(deleteItem(ITEM_ID)).resolves.toMatchObject({ success: false });
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('reports success once the row is gone', async () => {
    await expect(deleteItem(ITEM_ID)).resolves.toEqual({ success: true });
    expect(deleteRow).toHaveBeenCalledWith(ITEM_ID);
  });

  it('reads a row that did not match as not found rather than as a failure', async () => {
    deleteRow.mockResolvedValue(false);

    // Somebody else's item and an unknown id are the same answer.
    await expect(deleteItem(ITEM_ID)).resolves.toEqual({
      success: false,
      error: 'That item could not be found.',
    });
  });

  it('turns a thrown query into a generic failure rather than leaking it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteRow.mockRejectedValue(new Error('connection to db-prod-01 refused'));

    await expect(deleteItem(ITEM_ID)).resolves.toEqual({
      success: false,
      error: 'Could not delete this item. Please try again.',
    });
  });
});

describe('createItem', () => {
  const data = { typeId: 'type_1', title: 'useDebounce' };

  it('refuses before touching the database when nobody is signed in', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(createItem(data)).resolves.toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(findType).not.toHaveBeenCalled();
    expect(createRow).not.toHaveBeenCalled();
  });

  it('rejects a type the user cannot see, without writing anything', async () => {
    // An id belonging to another user's custom type resolves to nothing, and
    // reads the same as an id that names no type at all.
    findType.mockResolvedValue(null);

    const result = await createItem({ ...data, typeId: 'someone_elses_type' });

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { typeId: ['Choose an item type'] },
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('writes the resolved type id rather than the one that arrived', async () => {
    findType.mockResolvedValue({ id: 'resolved_type', slug: 'snippet' });

    await createItem(data);

    expect(createRow.mock.calls[0][0]).toMatchObject({ typeId: 'resolved_type' });
  });

  it('requires a URL on a link item, since the type it resolved to says so', async () => {
    findType.mockResolvedValue({ id: 'type_link', slug: 'link' });

    const result = await createItem({ typeId: 'type_link', title: 'A link' });

    expect(result).toMatchObject({ success: false, fieldErrors: { url: ['URL is required'] } });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('accepts a link item that carries its URL', async () => {
    findType.mockResolvedValue({ id: 'type_link', slug: 'link' });

    await expect(
      createItem({ typeId: 'type_link', title: 'A link', url: 'https://example.com' })
    ).resolves.toEqual({ success: true, data: saved });
  });

  it('does not demand a URL from a type that has no URL field', async () => {
    await expect(createItem(data)).resolves.toEqual({ success: true, data: saved });
  });

  it('reports the field a bad value belongs to', async () => {
    const result = await createItem({ typeId: 'type_1', title: '   ' });

    expect(result).toMatchObject({
      success: false,
      error: 'Check the highlighted fields and try again.',
      fieldErrors: { title: ['Title is required'] },
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('rejects a missing type before it can reach the lookup', async () => {
    const result = await createItem({ typeId: '', title: 'useDebounce' });

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { typeId: ['Choose an item type'] },
    });
    expect(findType).not.toHaveBeenCalled();
  });

  it('hands the query function the normalized values, not what was typed', async () => {
    await createItem({
      typeId: 'type_1',
      title: '  useDebounce  ',
      description: '   ',
      tags: ['a', 'a'],
    });

    expect(createRow.mock.calls[0][0]).toMatchObject({
      title: 'useDebounce',
      // A blank field is stored as NULL, and a tag typed twice spends one slot.
      description: null,
      tags: ['a'],
    });
  });

  it('reports a failed write without leaking the error', async () => {
    createRow.mockRejectedValue(new Error('connection reset'));

    await expect(createItem(data)).resolves.toEqual({
      success: false,
      error: 'Could not create this item. Please try again.',
    });
  });
});
