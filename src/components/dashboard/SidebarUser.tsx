import { Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { currentUser } from '@/lib/mock-data';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** User area pinned to the bottom of the sidebar. Settings is display only. */
export function SidebarUser() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t px-4 py-3">
      <Avatar>
        {currentUser.image && <AvatarImage src={currentUser.image} alt={currentUser.name} />}
        <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{currentUser.name}</p>
        <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
      </div>

      <Button variant="ghost" size="icon" aria-label="Settings">
        <Settings className="size-4" />
      </Button>
    </div>
  );
}
