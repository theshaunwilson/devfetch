import { NextResponse } from 'next/server';

import { consumeEmailVerificationToken } from '@/lib/auth/verification-token';
import { SIGN_IN_PATH } from '@/lib/auth-redirect';

// Reads the query string and writes to the database on every request.
export const dynamic = 'force-dynamic';

/**
 * The target of the link in the verification email. Every outcome lands back
 * on `/sign-in`, so the user always ends up somewhere they can act on rather
 * than looking at a bare status page.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get('token');
  const destination = new URL(SIGN_IN_PATH, request.url);

  if (!token) {
    destination.searchParams.set('verifyError', 'invalid');

    return NextResponse.redirect(destination);
  }

  const result = await consumeEmailVerificationToken(token);

  if (result.status === 'verified') {
    destination.searchParams.set('verified', '1');
  } else {
    destination.searchParams.set('verifyError', result.status);
  }

  return NextResponse.redirect(destination);
}
