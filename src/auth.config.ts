import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';

/**
 * The edge-safe half of the auth config: providers and anything else that runs
 * without a database. The proxy builds its own NextAuth instance from this so
 * Prisma never gets pulled into the request-interception path.
 *
 * The adapter, session strategy and callbacks live in `src/auth.ts`.
 */
export default {
  // Reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET from the environment.
  providers: [GitHub],
} satisfies NextAuthConfig;
