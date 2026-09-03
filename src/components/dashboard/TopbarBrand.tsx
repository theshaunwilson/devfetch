'use client';

import { Brand } from '@/components/dashboard/Brand';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { cn } from '@/lib/utils';

/**
 * The brand in the top bar. Always shown on mobile; on desktop only while the
 * sidebar is collapsed, since the sidebar carries its own brand when open —
 * the same rule `TopbarToggle` follows. Without it, collapsing the sidebar
 * clips the only brand away and takes the way back to the dashboard with it.
 */
export function TopbarBrand() {
  const { isOpen } = useSidebar();

  return <Brand href="/dashboard" className={cn('shrink-0', isOpen && 'md:hidden')} />;
}
