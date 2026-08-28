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

/**
 * Shared by every form that sets a password, so registration and reset cannot
 * end up disagreeing about what a mismatch says or which field it lands on.
 */
const PASSWORDS_MATCH = {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
};

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, PASSWORDS_MATCH);

/**
 * Deliberately looser than `registerSchema`: sign-in only needs the fields to
 * be present and shaped like credentials. Rejecting a short password here
 * would tell an attacker the password policy rather than "invalid credentials".
 */
export const signInSchema = z.object({
  email,
  password: z.string().min(1),
});

/**
 * Only the address — the caller has already proven the account is theirs by
 * getting the password right, and no other field is needed to reissue a link.
 */
export const resendVerificationSchema = z.object({ email });

/**
 * Only the address. Separate from `resendVerificationSchema` despite the same
 * shape: they answer different requests and either could gain a field.
 */
export const forgotPasswordSchema = z.object({ email });

/**
 * The new password and its confirmation. No current password and no email —
 * the reset token is what proves the account is theirs, and it is read from
 * the request rather than the form body.
 */
export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, PASSWORDS_MATCH);

/**
 * Changing a password from inside a session.
 *
 * `currentPassword` is deliberately as loose as `signInSchema`'s: enforcing
 * the policy on it would report "at least 8 characters" for a wrong guess,
 * naming the rule instead of just refusing. The new password gets the full
 * rule set, since that one is being written.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, PASSWORDS_MATCH);

/**
 * Deleting an account. Only the typed confirmation — the session says whose
 * account it is, and the address is compared against it on the server rather
 * than trusted from the form.
 *
 * Normalized the same way `email` is, so the confirmation matches the stored
 * address whatever case or padding it was typed with.
 */
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase(),
});
