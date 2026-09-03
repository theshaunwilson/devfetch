import { cookies } from 'next/headers';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider } from '@/components/dashboard/SidebarProvider';
import { Topbar } from '@/components/dashboard/Topbar';
import { ItemDrawerProvider } from '@/components/items/ItemDrawerProvider';
import { Toaster } from '@/components/ui/sonner';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { getSidebarCollections } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/items';
import { getCurrentUser } from '@/lib/db/user';
import { isSidebarOpen, SIDEBAR_COOKIE } from '@/lib/sidebar';

const SIDEBAR_COLLECTION_LIMIT = 5;

/**
 * Sidebar and top bar chrome, shared by every signed-in route that renders
 * inside it. The layout that mounts it must be `force-dynamic`, since the
 * sidebar reads its types and collections per request.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [itemTypes, collections, user, cookieStore] = await Promise.all([
    getItemTypes(),
    getSidebarCollections(SIDEBAR_COLLECTION_LIMIT),
    getCurrentUser(),
    cookies(),
  ]);

  // Read on the server so the first paint already has the right width. The
  // two sections mount their own AppShell, so this is also what carries the
  // choice across a move between /dashboard and /items.
  const sidebarOpen = isSidebarOpen(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* Outside the shell's `overflow-hidden`, and mounted here rather than in
          the root layout: toasts belong to the signed-in app, and the auth
          pages report themselves with inline banners. */}
      <Toaster position="bottom-right" />

      <div className="flex h-svh overflow-hidden">
        <Sidebar itemTypes={itemTypes} collections={collections} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* `tabIndex={-1}` so focus has somewhere to land when the element
              it would have returned to is gone — see the drawer's
              `onCloseAutoFocus`. */}
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
            {/* Wraps the pages rather than each list, so the one drawer serves
                the dashboard's two lists and the items grid alike. */}
            <ItemDrawerProvider>{children}</ItemDrawerProvider>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
