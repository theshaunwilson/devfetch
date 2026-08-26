import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/generated/prisma/client';
import { sendVerificationEmail } from '@/lib/email/verification';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation/auth';

/** Matches the cost `prisma/seed.ts` uses for the demo account. */
const BCRYPT_COST = 12;

const EMAIL_TAKEN = 'An account with that email already exists';

type RegisteredUser = {
  id: string;
  name: string | null;
  email: string;
};

type RegisterResponse =
  | { success: true; data: RegisteredUser }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function POST(request: Request): Promise<NextResponse<RegisterResponse>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be JSON' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return NextResponse.json(
      { success: false, error: 'Invalid registration details', fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing) {
      return NextResponse.json({ success: false, error: EMAIL_TAKEN }, { status: 409 });
    }

    const user = await prisma.user.create({
      // `emailVerified` stays null until the link in the email is clicked,
      // and `authorize` refuses a credentials sign-in until it is set.
      data: { name, email, password: await bcrypt.hash(password, BCRYPT_COST) },
      select: { id: true, name: true, email: true },
    });

    // Awaited but never fatal. The account exists either way, so a send that
    // fails must not turn into a 500 the user would read as "try again" —
    // they would only hit the duplicate-email path. `sendVerificationEmail`
    // logs the reason and the user can ask for another link from sign-in.
    await sendVerificationEmail(user.email);

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    // Two registrations for the same address can both clear the check above;
    // the unique index on `User.email` is what actually decides it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: EMAIL_TAKEN }, { status: 409 });
    }

    console.error('Registration failed:', error);

    return NextResponse.json({ success: false, error: 'Could not create the account' }, { status: 500 });
  }
}
