import { AppShell } from '@/components/dashboard/AppShell';

// Same shell as /dashboard, so the sidebar survives clicking one of its own
// type links. Dynamic for the same reason: the sidebar is read per request.
export const dynamic = 'force-dynamic';

export default function ItemsLayout({ children }: LayoutProps<'/items'>) {
  return <AppShell>{children}</AppShell>;
}
