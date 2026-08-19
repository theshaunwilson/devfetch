import { Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { CurrentUser } from '@/types/user';

interface SidebarUserProps {
  user: CurrentUser;
}

/** Name is nullable in the schema, so unnamed users fall back to their email. */
function getInitials(user: CurrentUser): string {
  if (!user.name) return user.email.charAt(0).toUpperCase();

  return user.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** User area pinned to the bottom of the sidebar. Settings is display only. */
export function SidebarUser({ user }: SidebarUserProps) {
  const displayName = user.name ?? user.email;

  return (
    <div className="flex shrink-0 items-center gap-3 border-t px-4 py-3">
      <Avatar>
        {user.image && <AvatarImage src={user.image} alt={displayName} />}
        <AvatarFallback>{getInitials(user)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {/* Skipped when the name is missing, since the line above is the email. */}
        {user.name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
      </div>

      <Button variant="ghost" size="icon" aria-label="Settings">
        <Settings className="size-4" />
      </Button>
    </div>
  );
}
