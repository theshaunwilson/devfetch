import NextAuth from 'next-auth';

import authConfig from '@/auth.config';

// Built from the edge-safe config rather than importing `@/auth`, which would
// drag the Prisma adapter into every matched request.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) {
    return;
  }

  // NextAuth's built-in sign-in page. It sends the user back here afterwards.
  const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin);
  signInUrl.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`);

  return Response.redirect(signInUrl);
});

export const config = {
  matcher: ['/dashboard/:path*'],
};
