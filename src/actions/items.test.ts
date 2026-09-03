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
vi.mock('@/lib/db/items', () => ({ updateItem: vi.fn() }));

const { auth } = await import('@/auth');
const { updateItem: updateItemRow } = await import('@/lib/db/items');
const { updateItem } = await import('./items');

const session = vi.mocked(auth);
const writeRow = vi.mocked(updateItemRow);

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
