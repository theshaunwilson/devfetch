import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';

import { SIGN_IN_PATH } from '@/lib/auth-redirect';

/**
 * The fields the default sign-in page renders for credentials, shared so the
 * real provider in `src/auth.ts` presents the same form.
 */
export const credentialsFields = {
  email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
  password: { label: 'Password', type: 'password' },
};

/**
 * The edge-safe half of the auth config: providers and anything else that runs
 * without a database. The proxy builds its own NextAuth instance from this so
 * Prisma never gets pulled into the request-interception path.
 *
 * The adapter, session strategy and callbacks live in `src/auth.ts`.
 */
export default {
  // Replaces the built-in `/api/auth/signin` and `/api/auth/error` screens.
  // Errors Auth.js raises outside a form action — OAuthAccountNotLinked, for
  // one — arrive back here as `?error=<code>`.
  pages: {
    signIn: SIGN_IN_PATH,
    error: SIGN_IN_PATH,
  },
  providers: [
    // Reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET from the environment.
    GitHub,
    // Placeholder only. Verifying a password means reading the user out of
    // Prisma, which this half of the config must not do, so `src/auth.ts`
    // swaps in the real `authorize`. Nothing signs in through this instance:
    // the proxy only reads the session cookie.
    Credentials({ credentials: credentialsFields, authorize: () => null }),
  ],
} satisfies NextAuthConfig;
