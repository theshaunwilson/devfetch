import { AppShell } from '@/components/dashboard/AppShell';

// The same shell as /dashboard, /items, /collections and /favorites, so the
// top bar's Upgrade button does not kill the chrome it was clicked from — the
// trap a top-level route without its own shell walks into. Dynamic for the
// same reason those are: the sidebar is read per request.
export const dynamic = 'force-dynamic';

export default function UpgradeLayout({ children }: LayoutProps<'/upgrade'>) {
  return <AppShell>{children}</AppShell>;
}
