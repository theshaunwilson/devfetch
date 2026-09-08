import { FieldError } from '@/components/auth/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';

interface PasswordFieldsProps {
  /** "Password" on register, "New password" where one is being replaced. */
  passwordLabel: string;
  confirmLabel: string;
  /**
   * Element ids. Defaulted to the field names, and overridable because
   * `ChangePasswordForm` also renders a `currentPassword` input and wants ids
   * that read as a set.
   */
  passwordId?: string;
  confirmId?: string;
  fieldErrors?: { password?: string[]; confirmPassword?: string[] };
}

/**
 * The new-password pair, shared by register, reset password and change
 * password.
 *
 * The `name` attributes are fixed rather than props: all three forms post to
 * schemas that expect `password` and `confirmPassword`, so they are part of
 * the contract. The ids are not — they only bind the label and the error to
 * the input, and must be unique on the page.
 *
 * The `aria-describedby` swap is why this is one component and not three
 * copies: each field points at either its error or its hint, and pointing at
 * the wrong one breaks screen-reader output without breaking anything visible.
 */
export function PasswordFields({
  passwordLabel,
  confirmLabel,
  passwordId = 'password',
  confirmId = 'confirmPassword',
  fieldErrors,
}: PasswordFieldsProps) {
  const passwordError = fieldErrors?.password;
  const confirmError = fieldErrors?.confirmPassword;

  const errorId = `${passwordId}-error`;
  const hintId = `${passwordId}-hint`;
  const confirmErrorId = `${confirmId}-error`;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={passwordId}>{passwordLabel}</Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? errorId : hintId}
        />
        {passwordError ? (
          <FieldError id={errorId} messages={passwordError} />
        ) : (
          <p id={hintId} className="text-xs text-muted-foreground">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={confirmId}>{confirmLabel}</Label>
        <Input
          id={confirmId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(confirmError)}
          aria-describedby={confirmError ? confirmErrorId : undefined}
        />
        <FieldError id={confirmErrorId} messages={confirmError} />
      </div>
    </>
  );
}
