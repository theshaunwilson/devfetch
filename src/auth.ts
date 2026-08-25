import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import authConfig, { credentialsFields } from '@/auth.config';
import { prisma } from '@/lib/prisma';
import { signInSchema } from '@/lib/validation/auth';

/**
 * A real hash of a value nobody can supply. An email with no account still
 * pays for one bcrypt comparison, so response time does not reveal whether
 * the address is registered.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$bBF7EBh3sAwyRPdnZGeSi.N7nkxUuqCzeVtd/y85b4aioix9Bt9Qe';

/**
 * The database-backed half of the placeholder in `src/auth.config.ts`.
 *
 * Returning `null` for every failure is deliberate: Auth.js turns it into a
 * generic `CredentialsSignin`, so a wrong password, an unknown email and an
 * OAuth-only account are indistinguishable to the caller.
 */
const credentialsProvider = Credentials({
  credentials: credentialsFields,
  async authorize(rawCredentials) {
    const parsed = signInSchema.safeParse(rawCredentials);

    if (!parsed.success) {
      return null;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true, password: true },
    });

    // `User.password` is null for accounts created through GitHub.
    const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);

    if (!user?.password || !passwordMatches) {
      return null;
    }

    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // Same providers in the same order, with only the credentials `authorize`
  // replaced — so the two configs cannot drift in any other respect.
  providers: authConfig.providers.map((provider) =>
    typeof provider !== 'function' && provider.type === 'credentials' ? credentialsProvider : provider,
  ),
  adapter: PrismaAdapter(prisma),
  // The Neon driver is not edge-safe, so sessions cannot be read from the
  // database in the proxy. JWTs are, which is what the split config buys us.
  // The Credentials provider requires this strategy regardless: Auth.js never
  // writes a database session for a credentials sign-in.
  session: { strategy: 'jwt' },
  callbacks: {
    session({ session, token }) {
      // Auth.js sets `token.sub` to the user id at sign-in, but its default
      // session only exposes name/email/image.
      if (token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});
