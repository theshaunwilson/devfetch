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

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db/collections', () => ({ createCollection: vi.fn() }));

const { auth } = await import('@/auth');
const { createCollection: createCollectionRow } = await import('@/lib/db/collections');
const { createCollection } = await import('./collections');

const session = vi.mocked(auth);
const createRow = vi.mocked(createCollectionRow);

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
  createRow.mockResolvedValue({ ok: true, collection: saved });
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
    );
  });

  it('hands the query function the description it was sent, trimmed', async () => {
    // Without this, an action that quietly dropped the description would pass
    // every other test here while the user's text went nowhere.
    await createCollection({ name: 'React Patterns', description: '  Hooks and patterns  ' });

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Hooks and patterns' }),
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
    );
  });
});
