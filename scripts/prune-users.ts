/**
 * Removes every user except the demo account, along with all of their content —
 * skipping any account with a Stripe customer, which could still be billed.
 *
 * Built for clearing test accounts off the development branch. Prints what it
 * would delete and changes nothing unless `--yes` is passed.
 *
 *   npm run db:prune-users          # dry run — lists what would go
 *   npm run db:prune-users -- --yes # actually delete
 */
import { config as loadEnv } from 'dotenv';

// Safe to import statically: no Prisma, no `server-only`, just the identifier
// format. The client itself still has to be imported dynamically, below.
import { allScopedIdentifiers } from '../src/lib/auth/token-scopes';

// Prisma 7 no longer loads .env files itself. Mirror Next.js precedence:
// .env.local wins, .env fills in the gaps.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

/** The one account that survives. Matches prisma/seed.ts. */
const KEEP_EMAIL = 'demo@devfetch.io';

const CONFIRM_FLAG = '--yes';

type Prisma = Awaited<typeof import('../src/lib/prisma')>['prisma'];

function hostOf(connectionString: string | undefined): string {
  if (!connectionString) return 'not set';
  try {
    return new URL(connectionString).host;
  } catch {
    return 'malformed connection string';
  }
}

function heading(text: string): void {
  console.log(`\n${text}\n${'─'.repeat(text.length)}`);
}

interface DoomedUser {
  id: string;
  email: string;
  name: string | null;
  items: number;
  collections: number;
  tags: number;
  itemTypes: number;
  accounts: number;
  sessions: number;
}

/**
 * Accounts with a Stripe customer are never pruned.
 *
 * Deleting the row does not stop Stripe charging: the subscription carries on
 * with no account left to cancel it from. `deleteAccount` cancels first, but
 * this script deliberately never calls Stripe — so it leaves those accounts
 * alone and says so. Cancel in Stripe, clear the columns, then re-run.
 */
async function findBilledUsers(prisma: Prisma): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { email: { not: KEEP_EMAIL }, stripeCustomerId: { not: null } },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((user) => user.email);
}

async function findDoomedUsers(prisma: Prisma): Promise<DoomedUser[]> {
  const users = await prisma.user.findMany({
    where: { email: { not: KEEP_EMAIL }, stripeCustomerId: null },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          items: true,
          collections: true,
          tags: true,
          itemTypes: true,
          accounts: true,
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return users.map(({ _count, ...user }) => ({ ...user, ..._count }));
}

function report(users: DoomedUser[]): void {
  heading(`Users to delete (${users.length})`);

  for (const user of users) {
    console.log(`  ${user.email}${user.name ? `  (${user.name})` : ''}`);
    console.log(
      `    items ${user.items}  collections ${user.collections}  tags ${user.tags}` +
        `  custom types ${user.itemTypes}  accounts ${user.accounts}  sessions ${user.sessions}`,
    );
  }
}

async function prune(prisma: Prisma, users: DoomedUser[]): Promise<void> {
  const userIds = users.map((user) => user.id);
  const emails = users.map((user) => user.email);

  // Explicitly ordered rather than left to `onDelete: Cascade` from `User`.
  // Deleting a user cascades to both their items and their custom item types,
  // but `Item.type` is `onDelete: Restrict` — so if the database happened to
  // clear the item types first, the restrict would abort the whole delete.
  // Emptying the referencing tables first removes the question.
  //
  // One statement per model, in a transaction: a partial prune would leave
  // orphaned content behind with no user to find it from.
  const [items, collections, tags, itemTypes, tokens, deleted] = await prisma.$transaction([
    // Cascades to the ItemTag join rows.
    prisma.item.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.collection.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.tag.deleteMany({ where: { userId: { in: userIds } } }),
    // Only their own types. The seeded system types have `userId: null`, and
    // a null never matches an `in` filter, so those are left alone.
    prisma.itemType.deleteMany({ where: { userId: { in: userIds } } }),
    // `VerificationToken` has no foreign key to `User`, so nothing cascades
    // here — an unclicked link would outlive the account it was issued for.
    // Identifiers are scoped (`"<scope>:<email>"`), so the addresses are
    // expanded through the same helper the app writes with rather than
    // matched raw; matching on the bare email finds nothing.
    prisma.verificationToken.deleteMany({
      where: { identifier: { in: emails.flatMap(allScopedIdentifiers) } },
    }),
    // Cascades to Account and Session.
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  heading('Deleted');
  console.log(`  users               ${deleted.count}`);
  console.log(`  items               ${items.count}`);
  console.log(`  collections         ${collections.count}`);
  console.log(`  tags                ${tags.count}`);
  console.log(`  custom item types   ${itemTypes.count}`);
  console.log(`  verification tokens ${tokens.count}`);
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes(CONFIRM_FLAG);

  heading('Target');
  console.log(`  host    ${hostOf(process.env.DATABASE_URL)}`);
  console.log(`  keeping ${KEEP_EMAIL}`);
  console.log(`  mode    ${confirmed ? 'DELETE' : 'dry run'}`);

  const { prisma } = await import('../src/lib/prisma');

  try {
    // The whole point of this script is to preserve the demo account. If it is
    // not here, this is not the branch it was written for — most likely
    // production, which has no demo user. Refuse rather than guess.
    const keeper = await prisma.user.findUnique({
      where: { email: KEEP_EMAIL },
      select: { id: true },
    });

    if (!keeper) {
      console.error(
        `\nRefusing to run: ${KEEP_EMAIL} does not exist on this database.` +
          '\nThat account is what this script preserves, so its absence means the' +
          '\nconnection is pointing somewhere unexpected. Check DATABASE_URL,' +
          '\nand run `npm run db:seed` if this really is the development branch.',
      );
      process.exitCode = 1;

      return;
    }

    const billed = await findBilledUsers(prisma);

    if (billed.length > 0) {
      heading(`Skipped — has a Stripe customer (${billed.length})`);

      for (const email of billed) console.log(`  ${email}`);
    }

    const users = await findDoomedUsers(prisma);

    if (users.length === 0) {
      console.log(`\nNothing to delete.`);

      return;
    }

    report(users);

    if (!confirmed) {
      console.log(
        `\nDry run — nothing was deleted.` +
          `\nRe-run with \`npm run db:prune-users -- ${CONFIRM_FLAG}\` to delete these ${users.length} user(s).`,
      );

      return;
    }

    await prune(prisma, users);

    const remaining = await prisma.user.count();
    console.log(`\nDone. ${remaining} user(s) remain.`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Neon's WebSocket driver rejects with a DOM-style `ErrorEvent` rather than an
 * `Error`, so the message has to be dug out by hand.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    const { message, error: cause } = error as { message?: unknown; error?: unknown };
    if (typeof message === 'string' && message.length > 0) return message;
    if (cause !== undefined && cause !== error) return messageOf(cause);
    if ((error as { type?: unknown }).type === 'error') {
      return 'connection failed — check DATABASE_URL and that the Neon branch is reachable';
    }
  }

  return String(error);
}

main().catch((error: unknown) => {
  console.error(`\nPrune failed: ${messageOf(error)}`);
  process.exitCode = 1;
});
