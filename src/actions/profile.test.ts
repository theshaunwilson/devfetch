/**
 * `deleteAccount` is irreversible and, for a Pro account, touches money: once
 * the row is gone nobody can reach Manage billing, so a subscription left
 * running keeps charging a card for an account that no longer exists. What is
 * pinned here is the order — billing stops first — and that a Stripe failure
 * refuses the delete rather than being logged and stepped over.
 *
 * Mocked at the module boundary — `@/auth`, `@/lib/prisma`,
 * `@/lib/stripe-subscriptions` — with the Zod schema left real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/stripe-subscriptions', () => ({ cancelLiveSubscriptions: vi.fn() }));
vi.mock('@/lib/prisma', () => {
  const deleteMany = () => vi.fn().mockResolvedValue({ count: 0 });

  return {
    prisma: {
      user: { findUnique: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
      item: { deleteMany: deleteMany() },
      collection: { deleteMany: deleteMany() },
      tag: { deleteMany: deleteMany() },
      itemType: { deleteMany: deleteMany() },
      verificationToken: { deleteMany: deleteMany() },
      $transaction: vi.fn(),
    },
  };
});

const { auth, signOut } = await import('@/auth');
const { prisma } = await import('@/lib/prisma');
const { cancelLiveSubscriptions } = await import('@/lib/stripe-subscriptions');
const { deleteAccount } = await import('./profile');

const session = vi.mocked(auth);
const findUser = vi.mocked(prisma.user.findUnique);
const transaction = vi.mocked(prisma.$transaction);
const cancel = vi.mocked(cancelLiveSubscriptions);

const USER_ID = 'user_1';
const EMAIL = 'someone@example.com';

/** The selected shape; `vi.mocked` on Prisma resolves to the full model. */
interface AccountRow {
  id: string;
  email: string;
  password: string | null;
  stripeCustomerId: string | null;
}

const account = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  id: USER_ID,
  email: EMAIL,
  password: null,
  stripeCustomerId: null,
  ...overrides,
});

function confirm(email = EMAIL): FormData {
  const form = new FormData();
  form.set('confirmEmail', email);

  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
  findUser.mockResolvedValue(account() as unknown as never);
  transaction.mockResolvedValue([] as unknown as never);
  cancel.mockResolvedValue(1);
});

describe('deleteAccount', () => {
  it('cancels the subscription before deleting anything', async () => {
    findUser.mockResolvedValue(account({ stripeCustomerId: 'cus_1' }) as unknown as never);

    await deleteAccount({}, confirm());

    expect(cancel).toHaveBeenCalledWith('cus_1');
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.mock.invocationCallOrder[0],
    );
    expect(signOut).toHaveBeenCalled();
  });

  it('refuses the delete when the subscription could not be cancelled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    findUser.mockResolvedValue(account({ stripeCustomerId: 'cus_1' }) as unknown as never);
    cancel.mockRejectedValue(new Error('Stripe unreachable'));

    const result = await deleteAccount({}, confirm());

    expect(result).toEqual({
      error: 'Could not cancel your subscription, so your account was not deleted. Please try again.',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('makes no Stripe call for an account that never checked out', async () => {
    await deleteAccount({}, confirm());

    expect(cancel).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled();
  });

  it('touches neither Stripe nor the database when the email does not match', async () => {
    findUser.mockResolvedValue(account({ stripeCustomerId: 'cus_1' }) as unknown as never);

    const result = await deleteAccount({}, confirm('someone-else@example.com'));

    expect(result).toMatchObject({ fieldErrors: { confirmEmail: expect.any(Array) } });
    expect(cancel).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('touches neither Stripe nor the database without a session', async () => {
    session.mockResolvedValue(null as unknown as never);

    await expect(deleteAccount({}, confirm())).resolves.toEqual({
      error: 'Your session has expired. Sign in again.',
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
