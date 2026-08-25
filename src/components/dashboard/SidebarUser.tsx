'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';

import { signOutAction } from '@/actions/auth';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { UserAvatar } from '@/components/user/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getDisplayName } from '@/lib/user';
import type { CurrentUser } from '@/types/user';

interface SidebarUserProps {
  user: CurrentUser;
}

/**
 * User area pinned to the bottom of the sidebar. The avatar opens an account
 * menu; the gear goes to the profile page.
 */
export function SidebarUser({ user }: SidebarUserProps) {
  const { closeMobile } = useSidebar();
  const displayName = getDisplayName(user);
  // The desktop sidebar and the mobile drawer both render this component, so
  // a literal id would appear twice and `form=` would resolve to the wrong one.
  const signOutFormId = useId();

  return (
    <div className="flex shrink-0 items-center gap-1 border-t px-3 py-3">
      {/* Outside the menu: the item that submits it unmounts when the menu closes. */}
      <form id={signOutFormId} action={signOutAction} className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent aria-expanded:bg-accent"
          >
            <UserAvatar user={user} />

            {/* Spans, not paragraphs: a button may only contain phrasing content. */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              {/* Skipped when the name is missing, since the line above is the email. */}
              {user.name && (
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              )}
            </span>
          </button>
        </DropdownMenuTrigger>

        {/* Opens upward: the row sits at the bottom of the sidebar. */}
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {user.name && (
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            )}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <button type="submit" form={signOutFormId} className="w-full">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button asChild variant="ghost" size="icon" aria-label="Profile">
        <Link href="/profile" onClick={closeMobile}>
          <Settings className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
