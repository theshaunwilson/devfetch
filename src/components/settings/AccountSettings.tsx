import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { SettingsRow } from '@/components/settings/SettingsRow';
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
