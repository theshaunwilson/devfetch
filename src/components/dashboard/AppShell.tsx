import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider } from '@/components/dashboard/SidebarProvider';
import { Topbar } from '@/components/dashboard/Topbar';
import { getSidebarCollections } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/items';
import { getCurrentUser } from '@/lib/db/user';

const SIDEBAR_COLLECTION_LIMIT = 5;

/**
 * Sidebar and top bar chrome, shared by every signed-in route that renders
 * inside it. The layout that mounts it must be `force-dynamic`, since the
 * sidebar reads its types and collections per request.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [itemTypes, collections, user] = await Promise.all([
    getItemTypes(),
    getSidebarCollections(SIDEBAR_COLLECTION_LIMIT),
    getCurrentUser(),
  ]);

  return (
    <SidebarProvider>
      <div className="flex h-svh overflow-hidden">
        <Sidebar itemTypes={itemTypes} collections={collections} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
