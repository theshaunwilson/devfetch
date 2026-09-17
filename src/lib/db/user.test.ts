/**
 * The first tests for `src/lib/db/user.ts`. Only the two editor-preference
 * functions are covered — the three that were already here are untouched.
 *
 * Two properties are worth pinning. `getEditorPreferences` must never fail:
 * it decides what an editor renders, so an absent session, a missing row and
 * an unusable column all have to come back as a working set. And
 * `saveEditorPreferences` must take its owner from the session and nowhere
 * else, since the caller sends no owner at all.
 *
 * Same pattern as `src/lib/db/items.test.ts`: mock `@/lib/prisma` and `@/auth`
 * at the module boundary, leave `parseEditorPreferences` real, so no database
 * is involved and the fallback under test is the one production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

const { auth } = await import('@/auth');
const { prisma } = await import('@/lib/prisma');
const { DEFAULT_EDITOR_PREFERENCES } = await import('@/lib/editor-preferences');
const { getEditorPreferences, saveEditorPreferences } = await import('./user');

const session = vi.mocked(auth);

/**
 * Both selected shapes at once. `getEditorPreferences` reads the column
 * directly off the session, while `saveEditorPreferences` goes through
 * `getCurrentUserId`, which runs the real `getCurrentUser` and so issues its
 * own lookup for the id — one mock has to satisfy both.
 */
interface PreferencesRow {
  id?: string;
  editorPreferences?: unknown;
}

const findUnique = prisma.user.findUnique as unknown as ReturnType<
  typeof vi.fn<(args: unknown) => Promise<PreferencesRow | null>>
>;
const update = prisma.user.update as unknown as ReturnType<typeof vi.fn>;

const USER_ID = 'user_1';

const STORED = {
  fontSize: 16,
  tabSize: 8,
  wordWrap: false,
  minimap: true,
  theme: 'monokai',
} as const;

function signedIn() {
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  findUnique.mockResolvedValue({ id: USER_ID, editorPreferences: STORED });
  update.mockResolvedValue({});
});

describe('getEditorPreferences', () => {
  it('returns what is stored', async () => {
    await expect(getEditorPreferences()).resolves.toEqual(STORED);
  });

  it('reads the row named by the session, selecting only the one column', async () => {
    await getEditorPreferences();

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { editorPreferences: true },
    });
  });

  it('gives the defaults with nobody signed in, and never queries', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(getEditorPreferences()).resolves.toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(findUnique).not.toHaveBeenCalled();
  });

  // The JWT outlives the row it names, so a valid session can point at nothing.
  it('gives the defaults when the session names a row that is gone', async () => {
    findUnique.mockResolvedValue(null);

    await expect(getEditorPreferences()).resolves.toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it('gives the defaults for a column that was never written', async () => {
    findUnique.mockResolvedValue({ editorPreferences: null });

    await expect(getEditorPreferences()).resolves.toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  // This feeds every editor in the app: an unusable column must cost the user
  // the field that is wrong, not the editor.
  it('falls back per field for a column written in an older shape', async () => {
    findUnique.mockResolvedValue({
      editorPreferences: { fontSize: 999, tabSize: 4, theme: 'hacker' },
    });

    await expect(getEditorPreferences()).resolves.toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      tabSize: 4,
    });
  });

  it('does not throw on a column holding something that is not an object', async () => {
    findUnique.mockResolvedValue({ editorPreferences: 'not json' });

    await expect(getEditorPreferences()).resolves.toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});

describe('saveEditorPreferences', () => {
  it('writes the preferences against the session user', async () => {
    await expect(saveEditorPreferences({ ...STORED })).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { editorPreferences: STORED },
    });
  });

  // The caller sends no owner, so there is nothing in the payload that could
  // redirect the write — this is what says the session decides.
  it('writes for the signed-in user even when the payload claims another', async () => {
    await saveEditorPreferences({ ...STORED, id: 'someone_else' } as never);

    const [args] = update.mock.calls[0] as [{ where: { id: string } }];

    expect(args.where.id).toBe(USER_ID);
  });

  it('reports failure and writes nothing with nobody signed in', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(saveEditorPreferences({ ...STORED })).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * The owner is resolved by looking the row up rather than trusting the id in
   * the JWT, which outlives the row it names. It is what turns a deleted
   * account into "sign in again" instead of an update that throws P2025 and
   * surfaces as "try again" against an account that no longer exists.
   */
  it('reports failure without writing when the session names a row that is gone', async () => {
    findUnique.mockResolvedValue(null);

    await expect(saveEditorPreferences({ ...STORED })).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('replaces the whole set rather than merging into what is there', async () => {
    await saveEditorPreferences({ ...STORED });

    const [args] = update.mock.calls[0] as [{ data: { editorPreferences: unknown } }];

    expect(Object.keys(args.data.editorPreferences as object).sort()).toEqual(
      Object.keys(DEFAULT_EDITOR_PREFERENCES).sort(),
    );
  });
});
