/**
 * A server action is a public endpoint: the payload is whatever was posted.
 * What is pinned here is the order it is dealt with — session first, then the
 * schema, then a write whose owner comes from neither — and that each failure
 * says enough for the form to point at the field responsible.
 *
 * Same pattern as `src/actions/items.test.ts`: mock the module boundary, leave
 * the Zod schema real so the action is tested against the rules production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/billing', () => ({ isProUser: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db/collections', () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setCollectionFavorite: vi.fn(),
}));

const { auth } = await import('@/auth');
const {
  createCollection: createCollectionRow,
  updateCollection: updateCollectionRow,
  deleteCollection: deleteCollectionRow,
  setCollectionFavorite: setCollectionFavoriteRow,
} = await import('@/lib/db/collections');
const { isProUser } = await import('@/lib/db/billing');
const { createCollection, updateCollection, deleteCollection, setCollectionFavorite } =
  await import('./collections');

const session = vi.mocked(auth);
const isPro = vi.mocked(isProUser);
const createRow = vi.mocked(createCollectionRow);
const updateRow = vi.mocked(updateCollectionRow);
const deleteRow = vi.mocked(deleteCollectionRow);
const favoriteRow = vi.mocked(setCollectionFavoriteRow);

const USER_ID = 'user_1';

const saved = {
  id: 'collection_1',
  name: 'React Patterns',
  description: null,
  isFavorite: false,
  itemCount: 0,
  types: [],
  accentColor: null,
};

/** `auth()` resolves to a full Session; only `user.id` is read. */
function signedIn() {
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  isPro.mockResolvedValue(false);
  createRow.mockResolvedValue({ ok: true, collection: saved });
  updateRow.mockResolvedValue({ ok: true });
  deleteRow.mockResolvedValue(true);
  favoriteRow.mockResolvedValue(true);
});

describe('createCollection', () => {
  it('returns the saved collection in full', async () => {
    const result = await createCollection({ name: 'React Patterns' });

    expect(result).toEqual({ success: true, data: saved });
  });

  it('refuses to write without a session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await createCollection({ name: 'React Patterns' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('checks the session before it parses the payload', async () => {
    // Reversed, an unauthenticated caller would be told which fields are wrong.
    session.mockResolvedValue(null as unknown as never);

    const result = await createCollection({ name: '' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
  });

  it('hands the query function the trimmed name, not the one it was sent', async () => {
    await createCollection({ name: '  React Patterns  ' });

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'React Patterns' }),
      expect.any(Boolean),
    );
  });

  it('hands the query function the description it was sent, trimmed', async () => {
    // Without this, an action that quietly dropped the description would pass
    // every other test here while the user's text went nowhere.
    await createCollection({ name: 'React Patterns', description: '  Hooks and patterns  ' });

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Hooks and patterns' }),
      expect.any(Boolean),
    );
  });

  it('reports a blank name on the field and never writes', async () => {
    const result = await createCollection({ name: '   ' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.fieldErrors?.name).toEqual(['Name is required']);
    expect(createRow).not.toHaveBeenCalled();
  });

  it('reports a duplicate name on the field so the form can point at it', async () => {
    createRow.mockResolvedValue({ ok: false, reason: 'duplicate-name' });

    const result = await createCollection({ name: 'React Patterns' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.fieldErrors?.name).toEqual([
      'You already have a collection with that name',
    ]);
  });

  it('reports an expired session when the row lookup finds no user', async () => {
    // The JWT outlives the row it names, so a valid session can still resolve
    // to nobody by the time the write runs.
    createRow.mockResolvedValue({ ok: false, reason: 'no-session' });

    const result = await createCollection({ name: 'React Patterns' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
  });

  it('does not leak a thrown database error to the caller', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    createRow.mockRejectedValue(new Error('connection lost'));

    const result = await createCollection({ name: 'React Patterns' });

    expect(result).toEqual({
      success: false,
      error: 'Could not create this collection. Please try again.',
    });
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it('never lets an owner in the payload reach the write', async () => {
    await createCollection({ name: 'React Patterns', userId: 'user_2' } as never);

    expect(createRow).toHaveBeenCalledWith(
      expect.not.objectContaining({ userId: expect.anything() }),
      expect.any(Boolean),
    );
  });
});

describe('updateCollection', () => {
  it('reports success without handing back a row', async () => {
    // A metadata edit cannot change the item count, type mix or accent colour,
    // so nothing comes back: the caller refreshes the surfaces it appears on.
    const result = await updateCollection('collection_1', { name: 'Renamed' });

    expect(result).toEqual({ success: true });
  });

  it('passes the id through as the address, never as data', async () => {
    await updateCollection('collection_1', { name: 'Renamed' });

    expect(updateRow).toHaveBeenCalledWith(
      'collection_1',
      expect.not.objectContaining({ id: expect.anything() }),
    );
  });

  it('refuses to write without a session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await updateCollection('collection_1', { name: 'Renamed' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('checks the session before it parses the payload', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await updateCollection('collection_1', { name: '' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
  });

  it('hands the query function the trimmed name, not the one it was sent', async () => {
    await updateCollection('collection_1', { name: '  Renamed  ' });

    expect(updateRow).toHaveBeenCalledWith(
      'collection_1',
      expect.objectContaining({ name: 'Renamed' }),
    );
  });

  it('hands the query function the description it was sent, trimmed', async () => {
    // Without this, an action that quietly dropped the description would pass
    // every other test here while the user's edit went nowhere.
    await updateCollection('collection_1', { name: 'Renamed', description: '  Hooks  ' });

    expect(updateRow).toHaveBeenCalledWith(
      'collection_1',
      expect.objectContaining({ description: 'Hooks' }),
    );
  });

  it('reports a blank name on the field and never writes', async () => {
    const result = await updateCollection('collection_1', { name: '   ' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.fieldErrors?.name).toEqual(['Name is required']);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('reports a duplicate name on the field so the form can point at it', async () => {
    updateRow.mockResolvedValue({ ok: false, reason: 'duplicate-name' });

    const result = await updateCollection('collection_1', { name: 'React Patterns' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.fieldErrors?.name).toEqual([
      'You already have a collection with that name',
    ]);
  });

  it('reports a missing row as not found, with no field to blame', async () => {
    updateRow.mockResolvedValue({ ok: false, reason: 'not-found' });

    const result = await updateCollection('collection_1', { name: 'Renamed' });

    expect(result).toEqual({ success: false, error: 'That collection could not be found.' });
  });

  it('reports an expired session when the row lookup finds no user', async () => {
    updateRow.mockResolvedValue({ ok: false, reason: 'no-session' });

    const result = await updateCollection('collection_1', { name: 'Renamed' });

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
  });

  it('does not leak a thrown database error to the caller', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    updateRow.mockRejectedValue(new Error('connection lost'));

    const result = await updateCollection('collection_1', { name: 'Renamed' });

    expect(result).toEqual({
      success: false,
      error: 'Could not save this collection. Please try again.',
    });
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

describe('deleteCollection', () => {
  it('reports success once the row is gone', async () => {
    const result = await deleteCollection('collection_1');

    expect(result).toEqual({ success: true });
    expect(deleteRow).toHaveBeenCalledWith('collection_1');
  });

  it('refuses to delete without a session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await deleteCollection('collection_1');

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('reports a row it could not delete as not found', async () => {
    // Somebody else's collection reads exactly like one that never existed.
    deleteRow.mockResolvedValue(false);

    const result = await deleteCollection('collection_1');

    expect(result).toEqual({ success: false, error: 'That collection could not be found.' });
  });

  it('does not leak a thrown database error to the caller', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    deleteRow.mockRejectedValue(new Error('connection lost'));

    const result = await deleteCollection('collection_1');

    expect(result).toEqual({
      success: false,
      error: 'Could not delete this collection. Please try again.',
    });
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

describe('setCollectionFavorite', () => {
  it('writes the value it was given rather than flipping the row', async () => {
    // Absolute, not a toggle: two clicks landing out of order settle on what
    // the last one asked for, where two toggles would cancel out.
    await setCollectionFavorite('collection_1', true);
    expect(favoriteRow).toHaveBeenCalledWith('collection_1', true);

    await setCollectionFavorite('collection_1', false);
    expect(favoriteRow).toHaveBeenCalledWith('collection_1', false);
  });

  it('reports success once the row is written', async () => {
    await expect(setCollectionFavorite('collection_1', true)).resolves.toEqual({ success: true });
  });

  it('refuses to write without a session', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await setCollectionFavorite('collection_1', true);

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(favoriteRow).not.toHaveBeenCalled();
  });

  it('refuses a flag that is not a boolean', async () => {
    // The argument is whatever the caller posted, so its TypeScript type is not
    // a guarantee — and a non-boolean reaching Prisma is a 500 where it should
    // be a refusal.
    const result = await setCollectionFavorite('collection_1', 'yes' as unknown as boolean);

    expect(result.success).toBe(false);
    expect(favoriteRow).not.toHaveBeenCalled();
  });

  it('reports a row it could not write as not found', async () => {
    // Somebody else's collection reads exactly like one that never existed.
    favoriteRow.mockResolvedValue(false);

    const result = await setCollectionFavorite('collection_1', true);

    expect(result).toEqual({ success: false, error: 'That collection could not be found.' });
  });

  it('does not leak a thrown database error to the caller', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    favoriteRow.mockRejectedValue(new Error('connection lost'));

    const result = await setCollectionFavorite('collection_1', true);

    expect(result).toEqual({
      success: false,
      error: 'Could not update that collection. Please try again.',
    });
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

describe('createCollection, at the ceiling', () => {
  it('names the limit rather than reporting a generic failure', async () => {
    createRow.mockResolvedValue({ ok: false, reason: 'limit-reached' });

    await expect(createCollection({ name: 'Fourth' })).resolves.toEqual({
      success: false,
      error:
        'Free accounts are limited to 3 collections. Upgrade to Pro for unlimited collections.',
    });
  });

  it('reports it on the form, not on the name field', async () => {
    // Nothing the user typed is wrong, so highlighting the input would point
    // at the wrong thing — and the dialog keeps what they typed either way.
    createRow.mockResolvedValue({ ok: false, reason: 'limit-reached' });

    const result = await createCollection({ name: 'Fourth' });

    expect(result).not.toHaveProperty('fieldErrors');
  });

  it('still reports a duplicate name on the field it belongs to', async () => {
    createRow.mockResolvedValue({ ok: false, reason: 'duplicate-name' });

    await expect(createCollection({ name: 'React Patterns' })).resolves.toMatchObject({
      fieldErrors: { name: ['You already have a collection with that name'] },
    });
  });

  it('hands the write the plan it resolved, rather than letting it assume one', async () => {
    isPro.mockResolvedValue(true);

    await createCollection({ name: 'Anything' });

    expect(createRow.mock.calls[0][1]).toBe(true);
  });
});
