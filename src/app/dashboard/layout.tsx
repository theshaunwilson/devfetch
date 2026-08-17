import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider } from '@/components/dashboard/SidebarProvider';
import { Topbar } from '@/components/dashboard/Topbar';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return (
    <SidebarProvider>
      <div className="flex h-svh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
