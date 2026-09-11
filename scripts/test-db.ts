/**
 * Database health check.
 *
 * Verifies that the app's Prisma client can reach the Neon branch configured
 * in .env.local, that every model is queryable, and prints the seeded demo
 * data. Read-only — it never writes, so it is safe to point at any branch.
 *
 * Run with: npm run db:test
 */
import { config as loadEnv } from 'dotenv';

// Prisma 7 no longer loads .env files itself. Mirror Next.js precedence:
// .env.local wins, .env fills in the gaps.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

// Kept local rather than imported from prisma/seed.ts, which runs on import.
const DEMO_EMAIL = 'demo@devfetch.io';

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

/** Marks favorited and pinned records so the dashboard's sections are easy to spot. */
function flags(record: { isFavorite?: boolean; isPinned?: boolean }): string {
  return [record.isFavorite ? '★' : '', record.isPinned ? '📌' : ''].join('');
}

async function printCounts(prisma: Prisma): Promise<void> {
  // A count per model doubles as a schema check: a table the client expects
  // but the database lacks surfaces here as an error.
  const counts = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    sessions: await prisma.session.count(),
    verificationTokens: await prisma.verificationToken.count(),
    items: await prisma.item.count(),
    itemTypes: await prisma.itemType.count(),
    collections: await prisma.collection.count(),
    itemCollections: await prisma.itemCollection.count(),
    tags: await prisma.tag.count(),
    itemTags: await prisma.itemTag.count(),
  };

  heading('Row counts');
  const width = Math.max(...Object.keys(counts).map((key) => key.length));
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model.padEnd(width)}  ${count}`);
  }
}

async function printItemTypes(prisma: Prisma): Promise<void> {
  const types = await prisma.itemType.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });

  heading(`Item types (${types.length})`);
  const width = Math.max(...types.map((type) => type.name.length));
  for (const type of types) {
    const scope = type.isSystem ? 'system' : 'custom';
    console.log(
      `  ${type.name.padEnd(width)}  ${(type.icon ?? '—').padEnd(11)}` +
        `${(type.color ?? '—').padEnd(9)}${scope.padEnd(8)}${type._count.items} items`,
    );
  }
}

/** Returns false when the demo user is missing, so the caller can hint at seeding. */
async function printDemoUser(prisma: Prisma): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  heading('Demo user');
  if (!user) {
    console.log(`  ${DEMO_EMAIL} not found`);
    return false;
  }

  // bcrypt hashes are $2<variant>$<cost>$<salt+digest> — surface the cost only.
  const cost = user.password?.split('$')[2] ?? null;
  console.log(`  ${user.email} — ${user.name ?? 'no name'}`);
  console.log(
    `  isPro: ${user.isPro}  ·  emailVerified: ${user.emailVerified?.toISOString().slice(0, 10) ?? 'no'}` +
      `  ·  password: ${cost ? `bcrypt, ${cost} rounds` : 'not set'}`,
  );
  return true;
}

async function printCollections(prisma: Prisma, userId: string): Promise<void> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    include: {
      // Items hang off the join table now, so each row is a filing and the
      // item itself is one level in.
      items: {
        include: { item: { include: { type: true, tags: { include: { tag: true } } } } },
        orderBy: { item: { title: 'asc' } },
      },
    },
    orderBy: { name: 'asc' },
  });

  heading(`Collections (${collections.length})`);
  for (const collection of collections) {
    const label = `${collection.name} ${flags(collection)}`.trimEnd();
    console.log(
      `\n  ${label} — ${collection.description ?? 'no description'}` +
        `  [${collection.color ?? 'no color'}]`,
    );

    const items = collection.items.map((filing) => filing.item);
    const width = Math.max(...items.map((item) => item.type.name.length));
    for (const item of items) {
      const tags = item.tags.map((link) => link.tag.name).join(', ');
      const title = `    ${item.type.name.padEnd(width)}  ${item.title} ${flags(item)}`.trimEnd();
      console.log(title + (tags ? `\n    ${' '.repeat(width)}  ↳ ${tags}` : ''));
    }
  }

  // An item with no filings at all, now that there is no column to be null.
  const uncollected = await prisma.item.count({
    where: { userId, collections: { none: {} } },
  });
  if (uncollected > 0) console.log(`\n  (${uncollected} items are not in a collection)`);
}

async function main(): Promise<void> {
  console.log(`Target: ${hostOf(process.env.DATABASE_URL)}`);

  // Imported dynamically because src/lib/prisma reads DATABASE_URL at import
  // time, which has to happen after the dotenv calls above.
  const { prisma } = await import('../src/lib/prisma');

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Connected in ${Date.now() - start}ms`);

    await printCounts(prisma);
    await printItemTypes(prisma);

    if (await printDemoUser(prisma)) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
      await printCollections(prisma, user.id);
      console.log('\nAll models queryable, demo data present.');
    } else {
      console.log('\nAll models queryable. Run `npm run db:seed` to load the demo data.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Neon's WebSocket driver rejects with a DOM-style ErrorEvent rather than an
 * Error, so unwrap a few shapes before falling back to the raw value.
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
  console.error(`\nDatabase check failed: ${messageOf(error)}`);
  process.exitCode = 1;
});
