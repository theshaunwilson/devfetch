import { AppShell } from '@/components/dashboard/AppShell';

// The same shell as every other signed-in page. This one used to render
// standalone, with "Back to dashboard" as its only way out — reached from the
// sidebar's account menu, it dropped the very sidebar it was opened from.
// Dynamic for the same reason the others are: the sidebar is read per request.
export const dynamic = 'force-dynamic';

export default function ProfileLayout({ children }: LayoutProps<'/profile'>) {
  return <AppShell>{children}</AppShell>;
}
