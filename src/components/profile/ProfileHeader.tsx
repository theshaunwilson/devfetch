import { CalendarDays } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { UserAvatar } from '@/components/user/UserAvatar';
import { formatLongDate } from '@/lib/format';
import { getDisplayName } from '@/lib/user';
import type { ProfileUser } from '@/types/user';

interface ProfileHeaderProps {
  user: ProfileUser;
  /** The account actions, rendered beneath the identity row. */
  actions: React.ReactNode;
}

/**
 * Identity card: avatar, name, email, when the account was created, and the
 * account actions.
 */
export function ProfileHeader({ user, actions }: ProfileHeaderProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <UserAvatar user={user} size="lg" className="size-16 shrink-0 text-lg" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="truncate text-lg font-semibold">{getDisplayName(user)}</h2>

            <Badge variant="outline" className="text-muted-foreground">
              {user.hasPassword ? 'Email' : 'GitHub'}
            </Badge>
          </div>

          {/* Skipped when the name is null, since `getDisplayName` already
              falls back to the email and would otherwise print it twice. */}
          {user.name && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}

          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start">
            <CalendarDays className="size-3.5 shrink-0" />
            Joined {formatLongDate(user.createdAt)}
          </p>
        </div>
      </CardContent>

      {/* Full width below `sm` so neither button can be squeezed narrower than
          its own label; auto width and right-aligned once there is room. */}
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">{actions}</CardFooter>
    </Card>
  );
}
