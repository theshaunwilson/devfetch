import { AppShell } from '@/components/dashboard/AppShell';

// Same shell as /dashboard, /items and /collections, so the sidebar survives
// clicking the top bar's star — which lives in that very chrome. Dynamic for
// the same reason: the sidebar is read per request.
export const dynamic = 'force-dynamic';

export default function FavoritesLayout({ children }: LayoutProps<'/favorites'>) {
  return <AppShell>{children}</AppShell>;
}
