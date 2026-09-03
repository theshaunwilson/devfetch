import { AppShell } from '@/components/dashboard/AppShell';

// The sidebar reads its types and collections per request, so the layout
// cannot be prerendered.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return <AppShell>{children}</AppShell>;
}
