import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider } from '@/components/dashboard/SidebarProvider';
import { Topbar } from '@/components/dashboard/Topbar';
import { getSidebarCollections } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/items';

// The sidebar reads its types and collections per request, so the layout
// cannot be prerendered.
export const dynamic = 'force-dynamic';

const SIDEBAR_COLLECTION_LIMIT = 5;

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const [itemTypes, collections] = await Promise.all([
    getItemTypes(),
    getSidebarCollections(SIDEBAR_COLLECTION_LIMIT),
  ]);

  return (
    <SidebarProvider>
      <div className="flex h-svh overflow-hidden">
        <Sidebar itemTypes={itemTypes} collections={collections} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
