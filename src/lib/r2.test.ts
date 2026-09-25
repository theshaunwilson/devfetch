/**
 * `deleteObjectsWithPrefix` is the one call in this app that deletes by
 * listing rather than by a key it was handed, so the property worth pinning is
 * the guard: it must refuse any prefix that is not one user's `users/<id>/`,
 * because an empty prefix lists — and would delete — the whole bucket.
 *
 * The S3 client is mocked at the module boundary; no request leaves the test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(readonly input: Record<string, unknown>) {}
  }

  return {
    S3Client: class {
      send = send;
    },
    ListObjectsV2Command: class extends Command {
      readonly kind = 'list';
    },
    DeleteObjectCommand: class extends Command {
      readonly kind = 'delete';
    },
    GetObjectCommand: class extends Command {},
    PutObjectCommand: class extends Command {},
  };
});

vi.stubEnv('R2_ACCOUNT_ID', 'account');
vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
vi.stubEnv('R2_BUCKET_NAME', 'bucket');

const { deleteObjectsWithPrefix } = await import('./r2');

interface SentCommand {
  kind: 'list' | 'delete';
  input: { Key?: string; Prefix?: string; ContinuationToken?: string };
}

function sent(kind: SentCommand['kind']): SentCommand['input'][] {
  return send.mock.calls
    .map(([command]) => command as SentCommand)
    .filter((command) => command.kind === kind)
    .map((command) => command.input);
}

beforeEach(() => {
  send.mockReset();
});

describe('deleteObjectsWithPrefix', () => {
  it.each(['', 'users/', 'users', 'users/user_1', 'users/user_1/nested/', 'other/user_1/'])(
    'refuses the unscoped prefix %j without listing anything',
    async (prefix) => {
      await expect(deleteObjectsWithPrefix(prefix)).rejects.toThrow('unscoped prefix');
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('lists under the prefix and deletes every object it finds', async () => {
    send.mockImplementation(async (command: SentCommand) =>
      command.kind === 'list'
        ? { Contents: [{ Key: 'users/user_1/a.png' }, { Key: 'users/user_1/b.pdf' }] }
        : {},
    );

    await expect(deleteObjectsWithPrefix('users/user_1/')).resolves.toBe(2);

    expect(sent('list')[0]).toMatchObject({ Prefix: 'users/user_1/' });
    expect(sent('delete').map((input) => input.Key)).toEqual([
      'users/user_1/a.png',
      'users/user_1/b.pdf',
    ]);
  });

  it('follows the continuation token until the listing is exhausted', async () => {
    let page = 0;

    send.mockImplementation(async (command: SentCommand) => {
      if (command.kind !== 'list') return {};

      page += 1;

      return page === 1
        ? { Contents: [{ Key: 'users/user_1/a.png' }], IsTruncated: true, NextContinuationToken: 't2' }
        : { Contents: [{ Key: 'users/user_1/b.png' }], IsTruncated: false };
    });

    await expect(deleteObjectsWithPrefix('users/user_1/')).resolves.toBe(2);
    expect(sent('list')[1]).toMatchObject({ ContinuationToken: 't2' });
  });

  it('removes nothing, successfully, for a user with no objects', async () => {
    send.mockResolvedValue({});

    await expect(deleteObjectsWithPrefix('users/user_1/')).resolves.toBe(0);
    expect(sent('delete')).toEqual([]);
  });
});
