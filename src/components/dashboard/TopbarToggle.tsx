'use client';

import { Menu, PanelLeft } from 'lucide-react';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Top bar entry point for the sidebar: a hamburger on mobile, the panel
 * icon on desktop. Always available on mobile; on desktop it only appears
 * while the sidebar is collapsed, since the sidebar carries its own toggle
 * when it is open.
 */
export function TopbarToggle() {
  const { isOpen, isMobileOpen, isMobile, toggle } = useSidebar();
  const expanded = isMobile ? isMobileOpen : isOpen;

  return (
    <div className={cn('flex items-center gap-3', isOpen && 'md:hidden')}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Close navigation' : 'Open navigation'}
      >
        <Menu className="size-4.5 md:hidden" />
        <PanelLeft className="hidden size-4.5 md:block" />
      </Button>

      <Separator orientation="vertical" className="hidden h-8 sm:block" />
    </div>
  );
}
