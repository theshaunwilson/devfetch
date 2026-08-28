import { CalendarDays } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/user/UserAvatar';
import { formatLongDate } from '@/lib/format';
import { getDisplayName } from '@/lib/user';
import type { ProfileUser } from '@/types/user';

/** Identity card: avatar, name, email and when the account was created. */
export function ProfileHeader({ user }: { user: ProfileUser }) {
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
    </Card>
  );
}
