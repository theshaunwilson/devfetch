'use client';

import { SidebarContent } from '@/components/dashboard/SidebarContent';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SidebarCollections } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';
import type { CurrentUser } from '@/types/user';

interface SidebarProps {
  itemTypes: SidebarItemType[];
  collections: SidebarCollections;
  user: CurrentUser | null;
  /** Shows the plan badge, and hides the type gate markers the viewer is past. */
  isPro: boolean;
}

/**
 * Collapsible sidebar: a fixed column from `md` up, a drawer below it.
 */
export function Sidebar({ itemTypes, collections, user, isPro }: SidebarProps) {
  const { isOpen, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Named for the same reason the nav inside it is: an unlabelled
          complementary landmark is announced only as "complementary". */}
      <aside
        aria-label="Sidebar"
        inert={!isOpen}
        className={cn(
          'hidden shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-in-out md:block',
          isOpen ? 'w-64' : 'w-0 border-r-0'
        )}
      >
        <div className="h-full w-64">
          <SidebarContent itemTypes={itemTypes} collections={collections} user={user} isPro={isPro} />
        </div>
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Item types, collections and account
          </SheetDescription>
          <SidebarContent itemTypes={itemTypes} collections={collections} user={user} isPro={isPro} />
        </SheetContent>
      </Sheet>
    </>
  );
}
