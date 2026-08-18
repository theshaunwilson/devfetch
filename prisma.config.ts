import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer loads .env files itself. Mirror Next.js precedence:
// .env.local wins, .env fills in the gaps (dotenv never overwrites a set var).
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct connection — Neon's pooled endpoint runs
    // PgBouncer in transaction mode, which breaks Prisma Migrate's advisory
    // locks. The app itself still uses the pooled DATABASE_URL at runtime.
    url: process.env.DIRECT_DATABASE_URL ?? env<Env>('DATABASE_URL'),
  },
});
