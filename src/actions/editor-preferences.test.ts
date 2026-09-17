/**
 * A server action is a public endpoint, so the payload is whatever was posted.
 * What is pinned here is that validation happens before the write, that a
 * refused set writes nothing at all, and that what reaches the database is the
 * *parsed* value rather than the object that arrived.
 *
 * Same pattern as `src/actions/collections.test.ts`: mock the module boundary
 * and leave the Zod schema real, so the action is tested against the rules
 * production runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/user', () => ({ saveEditorPreferences: vi.fn() }));

const { saveEditorPreferences } = await import('@/lib/db/user');
const { DEFAULT_EDITOR_PREFERENCES } = await import('@/lib/editor-preferences');
const { updateEditorPreferences } = await import('./editor-preferences');

const save = vi.mocked(saveEditorPreferences);

const VALID = {
  fontSize: 16,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  theme: 'monokai',
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue(true);
});

describe('updateEditorPreferences', () => {
  it('saves a valid set and reports success', async () => {
    const result = await updateEditorPreferences({ ...VALID });

    expect(result).toEqual({ success: true });
    expect(save).toHaveBeenCalledWith(VALID);
  });

  it('saves the defaults', async () => {
    const result = await updateEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES });

    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalledWith(DEFAULT_EDITOR_PREFERENCES);
  });

  // The whole point of validating before writing: a refused value must not
  // reach the column at all, not even as a silently corrected one.
  it('writes nothing when a value is not on the menu', async () => {
    const result = await updateEditorPreferences({ ...VALID, fontSize: 999 } as never);

    expect(result.success).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('names the field that was refused, so the form can point at it', async () => {
    const result = await updateEditorPreferences({ ...VALID, theme: 'hacker' } as never);

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.theme).toBeDefined();
    expect(result.error).toBeTruthy();
  });

  it('refuses a partial set rather than merging it over what is stored', async () => {
    const result = await updateEditorPreferences({ fontSize: 14 } as never);

    expect(result.success).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  // Nothing in the payload says whose preferences these are — the owner comes
  // from the session inside the query function. Anything owner-shaped that
  // arrives must be dropped on the way through.
  it('passes on only the five preferences, whatever else was posted', async () => {
    await updateEditorPreferences({ ...VALID, userId: 'someone_else', isPro: true } as never);

    expect(save).toHaveBeenCalledWith(VALID);
  });

  it('reports an expired session rather than a validation failure', async () => {
    save.mockResolvedValue(false);

    const result = await updateEditorPreferences({ ...VALID });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sign in/i);
    expect(result.fieldErrors).toBeUndefined();
  });

  it('absorbs a database failure instead of throwing at the caller', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    save.mockRejectedValue(new Error('connection lost'));

    const result = await updateEditorPreferences({ ...VALID });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/try again/i);
    error.mockRestore();
  });

  // The failure the user sees must not be the one the database raised: it can
  // name a column, a constraint, or a host.
  it('does not leak the database error to the caller', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    save.mockRejectedValue(new Error('relation "User" does not exist at ep-secret-host'));

    const result = await updateEditorPreferences({ ...VALID });

    expect(result.error).not.toMatch(/ep-secret-host|relation/i);
    error.mockRestore();
  });
});
