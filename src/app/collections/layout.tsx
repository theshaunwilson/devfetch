import { AppShell } from '@/components/dashboard/AppShell';

// Same shell as /dashboard and /items, so the sidebar survives clicking its own
// "View all collections" link. Dynamic for the same reason: the sidebar is read
// per request.
export const dynamic = 'force-dynamic';

export default function CollectionsLayout({ children }: LayoutProps<'/collections'>) {
  return <AppShell>{children}</AppShell>;
}
