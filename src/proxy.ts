import NextAuth from 'next-auth';

import authConfig from '@/auth.config';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';

// Built from the edge-safe config rather than importing `@/auth`, which would
// drag the Prisma adapter into every matched request.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) {
    return;
  }

  // The custom sign-in page. It sends the user back here afterwards.
  const signInUrl = new URL(SIGN_IN_PATH, req.nextUrl.origin);
  signInUrl.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`);

  return Response.redirect(signInUrl);
});

export const config = {
  // `:path*` matches zero segments too, so `/profile` itself is covered.
  matcher: [
    '/collections/:path*',
    '/dashboard/:path*',
    '/favorites/:path*',
    '/items/:path*',
    '/profile/:path*',
    '/settings/:path*',
  ],
};
