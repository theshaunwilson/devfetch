import { z } from 'zod';

/**
 * Matches the seeded demo account (`12345678`), so raising this floor would
 * lock that user out of credentials sign-in.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Postgres compares `User.email` case-sensitively, so every write and lookup
 * normalizes first — otherwise `Demo@devfetch.io` registers a second account.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  // Piped rather than chained: Zod validates before it transforms, so
  // `z.email().trim()` would reject " user@example.com " instead of cleaning it.
  .pipe(z.email('Enter a valid email address'));

/**
 * bcrypt hashes at most 72 bytes and silently ignores the rest, so without
 * this cap a longer password would also authenticate when anything after the
 * 72nd byte is changed — or dropped entirely. Measured in bytes, not
 * characters, since one emoji is four of them.
 */
export const PASSWORD_MAX_BYTES = 72;

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
    message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Deliberately looser than `registerSchema`: sign-in only needs the fields to
 * be present and shaped like credentials. Rejecting a short password here
 * would tell an attacker the password policy rather than "invalid credentials".
 */
export const signInSchema = z.object({
  email,
  password: z.string().min(1),
});
