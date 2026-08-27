import bcrypt from 'bcryptjs';

/**
 * Matches the cost `prisma/seed.ts` uses for the demo account. Kept here
 * rather than in either caller, so registration and password reset cannot
 * drift onto different costs.
 */
const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
