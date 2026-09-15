import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AccountSettingsProps {
  /** The address the delete confirmation asks to be typed back. */
  email: string;
  /** False for an account that signs in with GitHub and has no password. */
  hasPassword: boolean;
  itemCount: number;
  collectionCount: number;
}

interface SettingsRowProps {
  title: string;
  description: string;
  action: React.ReactNode;
  /** Tints the heading for a destructive action, matching its button. */
  destructive?: boolean;
}

/**
 * One labelled action. The text block carries `min-w-0` so a long word cannot
 * push the action out of the card, and the row stacks below `sm` so neither
 * half is squeezed narrower than its own content on a phone.
 */
function SettingsRow({
  title,
  description,
  action,
  destructive = false,
}: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h3
          className={`text-sm font-medium ${destructive ? 'text-destructive' : ''}`}
        >
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="sm:shrink-0">{action}</div>
    </div>
  );
}

/** The account actions: change password where there is one, and delete. */
export function AccountSettings({
  email,
  hasPassword,
  itemCount,
  collectionCount,
}: AccountSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Update your account security and preferences.
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y">
        {/* Only for accounts that sign in with a password. A GitHub account
            has none to change, and is told why rather than shown one row
            fewer with no explanation. */}
        {hasPassword ? (
          <SettingsRow
            title="Password"
            description="Change your password to keep your account secure"
            action={<ChangePasswordDialog />}
          />
        ) : (
          <SettingsRow
            title="Password"
            description="You sign in with GitHub, so this account has no password to change"
            action={null}
          />
        )}

        <SettingsRow
          destructive
          title="Delete account"
          description="Permanently delete your account and all associated data"
          action={
            <DeleteAccountDialog
              email={email}
              itemCount={itemCount}
              collectionCount={collectionCount}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
