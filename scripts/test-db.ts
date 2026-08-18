/**
 * Database health check.
 *
 * Verifies that the app's Prisma client can reach the Neon branch configured
 * in .env.local and that every model in the schema is queryable. Read-only —
 * it never writes, so it is safe to point at any branch.
 *
 * Run with: npm run db:test
 */
import { config as loadEnv } from 'dotenv';

// Prisma 7 no longer loads .env files itself. Mirror Next.js precedence:
// .env.local wins, .env fills in the gaps.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

function hostOf(connectionString: string | undefined): string {
  if (!connectionString) return 'not set';
  try {
    return new URL(connectionString).host;
  } catch {
    return 'malformed connection string';
  }
}

async function main() {
  console.log(`Target: ${hostOf(process.env.DATABASE_URL)}\n`);

  // Imported dynamically because src/lib/prisma reads DATABASE_URL at import
  // time, which has to happen after the dotenv calls above.
  const { prisma } = await import('../src/lib/prisma');

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Connected in ${Date.now() - start}ms\n`);

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
      tags: await prisma.tag.count(),
      itemTags: await prisma.itemTag.count(),
    };

    const width = Math.max(...Object.keys(counts).map((key) => key.length));
    for (const [model, count] of Object.entries(counts)) {
      console.log(`  ${model.padEnd(width)}  ${count}`);
    }

    console.log('\nAll models queryable.');
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
