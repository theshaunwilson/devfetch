import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';

import authConfig from '@/auth.config';
import { prisma } from '@/lib/prisma';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // The Neon driver is not edge-safe, so sessions cannot be read from the
  // database in the proxy. JWTs are, which is what the split config buys us.
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
