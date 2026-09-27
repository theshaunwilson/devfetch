/**
 * The helper behind every favorite and pin toggle. `@/auth` is mocked at the
 * module boundary and the write is a plain spy, so what is pinned is the order
 * of the gates and what each outcome reads as — not any one table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/auth';

import { SESSION_EXPIRED } from './action-messages';
import { setFlag } from './set-flag';

const session = vi.mocked(auth);
const write = vi.fn<(id: string, value: boolean) => Promise<boolean>>();
const spec = { noun: 'item', label: 'pin', write };

beforeEach(() => {
  vi.clearAllMocks();
  // `auth()` is typed as NextAuth's overloaded handler, so the session shape is
  // cast rather than built.
  session.mockResolvedValue({ user: { id: 'user_1' } } as unknown as never);
  write.mockResolvedValue(true);
});

describe('setFlag', () => {
  it('writes the value it was given and reports success', async () => {
    await expect(setFlag('item_1', true, spec)).resolves.toEqual({ success: true });
    expect(write).toHaveBeenCalledWith('item_1', true);
  });

  it('refuses without a session and never writes', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(setFlag('item_1', true, spec)).resolves.toEqual({
      success: false,
      error: SESSION_EXPIRED,
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses a flag that is not a boolean, since a caller can post anything', async () => {
    const result = await setFlag('item_1', 'yes' as unknown as boolean, spec);

    expect(result).toEqual({ success: false, error: 'Could not update that item. Please try again.' });
    expect(write).not.toHaveBeenCalled();
  });

  it('reads a row that is not this user’s as not found, naming the noun', async () => {
    write.mockResolvedValue(false);

    await expect(setFlag('item_1', false, { ...spec, noun: 'collection' })).resolves.toEqual({
      success: false,
      error: 'That collection could not be found.',
    });
  });

  it('logs a failed write under its label and returns a generic failure', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    write.mockRejectedValue(new Error('db down'));

    await expect(setFlag('item_1', true, spec)).resolves.toEqual({
      success: false,
      error: 'Could not update that item. Please try again.',
    });
    expect(logged).toHaveBeenCalledWith('Could not update the item pin:', expect.any(Error));
  });
});
